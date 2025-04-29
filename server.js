import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as tf from '@tensorflow/tfjs';

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Хранилище для точек данных
let dataPoints = [];
let nextId = 1;

let currentTrainData = [];
let currentTestData = [];
let currentTrainRatio = null;
let currentDataHash = '';

// Генерация случайных данных с шумом
function generateDataWithNoise(numPoints = 100, degree = 1, noiseLevel = 0.5) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const x = Math.random() * 10;
        let y = Math.sin(x * 0.5) * 3 + Math.pow(x, 0.5) * 2;
        y += (Math.random() - 0.5) * noiseLevel * 10;
        points.push({ x, y, id: nextId++ });
    }
    return points;
}
// Инициализация начальных данных
dataPoints = generateDataWithNoise();

app.post('/update_noise', (req, res) => {
    const { noiseLevel } = req.body;
    
    dataPoints = dataPoints.map(p => {
        const baseY = Math.sin(p.x * 0.5) * 3 + Math.pow(p.x, 0.5) * 2;
        const newY = baseY + (Math.random() - 0.5) * noiseLevel * 10;
        return { ...p, y: newY };
    });

    res.json({ message: 'Noise updated', points: dataPoints });
});

app.post('/add_point', (req, res) => {
    const { x, y } = req.body;
    const newPoint = { x, y, id: nextId++ };
    dataPoints.push(newPoint);
    res.json({ message: 'Point added', point: newPoint });
});

app.delete('/delete_last_point', (req, res) => {
    dataPoints.pop();
    res.json({ message: 'Last point deleted' });
});

app.delete('/delete_point/:id', (req, res) => {
    const id = parseInt(req.params.id);
    dataPoints = dataPoints.filter(p => p.id !== id);
    res.json({ message: 'Point deleted' });
});

app.post('/reset_points', (req, res) => {
    const { noiseLevel = 0.5, degree = 1 } = req.body;
    dataPoints = generateDataWithNoise(100, degree, noiseLevel);
    nextId = 1;
    res.json({ message: 'Points reset' });
});

function addPolynomialFeatures(x, degree) {
    return Array(degree + 1).fill(0).map((_, i) => Math.pow(x, i));
}

function getDataHash(data) {
    return data.map(p => `${p.id}:${p.x},${p.y}`).join('|');
}

app.post('/train_model', async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            degree = 1,
            trainRatio = 70,
            loss_function = 'MSE',
            regularizationType = 'None',
            iterations = 1000,
            learningRate = 0.01
        } = req.body;

        // Разделение данных на train/test
        const newDataHash = getDataHash(dataPoints);
        const shouldResplit = 
            trainRatio !== currentTrainRatio ||
            newDataHash !== currentDataHash;

        if (shouldResplit) {
            const shuffled = [...dataPoints].sort(() => 0.5 - Math.random());
            const trainSize = Math.floor(shuffled.length * (trainRatio / 100));
            currentTrainData = shuffled.slice(0, trainSize);
            currentTestData = shuffled.slice(trainSize);
            currentTrainRatio = trainRatio;
            currentDataHash = newDataHash;
        }

        const trainData = currentTrainData;
        const testData = currentTestData;

        const trainXs = trainData.map(p => addPolynomialFeatures(p.x, degree));
        const testXs = testData.map(p => addPolynomialFeatures(p.x, degree));
        const trainYs = trainData.map(p => p.y);
        const testYs = testData.map(p => p.y);

        // // Нормализация данных
        // const normalize = (values, min, max) => 
        //     values.map(v => v.map(x => (x - min) / (max - min)));

        // const allFeatures = trainXs.flat();
        // const min = Math.min(...allFeatures);
        // const max = Math.max(...allFeatures);

        // const normalizedTrainXs = normalize(trainXs, min, max);
        // const normalizedTestXs = normalize(testXs, min, max);

        // Создание модели
        const model = tf.sequential();
        model.add(tf.layers.dense({
            units: 1,
            inputShape: [degree + 1],
            kernelRegularizer: regularizationType === 'L1' 
            ? tf.regularizers.l1({ l1: 0.1 }) 
            : regularizationType === 'L2' 
                ? tf.regularizers.l2({ l2: 0.1 }) 
                : undefined
        }));

        // Компиляция модели
        model.compile({
            optimizer: tf.train.adam(learningRate),
            loss: loss_function === 'MAE' ? 'meanAbsoluteError' : 'meanSquaredError'
        });

        const xValues = Array.from({ length: 100 }, (_, i) => i * 0.1);

        let trainingHistory = [];
        const saveInterval = Math.max(1, Math.floor(iterations / 100));

        // Обучение
        await model.fit(
            tf.tensor2d(trainXs, [trainXs.length, degree + 1]),
            tf.tensor2d(trainYs, [trainYs.length, 1]),
            { 
                epochs: iterations,
                batchSize: trainXs.length,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        // Сохраняем каждые N итераций
                        if (epoch % saveInterval === 0 || epoch === iterations - 1) {
                            const weights = model.layers[0].getWeights()[0].dataSync();
                            const bias = model.layers[0].getWeights()[1].dataSync()[0];
                            
                            trainingHistory.push({
                                step: epoch,
                                weights: Array.from(weights),
                                bias,
                                predictions: xValues.map(x => ({
                                    x,
                                    y: model.predict(tf.tensor2d([addPolynomialFeatures(x, degree)], [1, degree + 1])).dataSync()[0]
                                })),
                                equation: generateEquation(weights, bias),
                                error: logs.loss
                            });
                        }
                    }
                }
            }
        );


        const kernelWeights = model.layers[0].getWeights()[0].dataSync();
        const bias = model.layers[0].getWeights()[1].dataSync()[0];
        const weights = Array.from(kernelWeights);

        // const denormalizedWeights = weights.map((w, i) => 
        //     w / (max - min) ** i // Корректировка для min-max
        // );

        let equation = `y = `;
        for (let i = weights.length - 1; i > 0; i--) {
            const power = i;
            if (power < 0) break;
            equation += ` + ${weights[i].toFixed(2)}${power > 1 ? `x^${power}` : 'x'}`;
        }
        equation += ` + ${(bias + weights[0]).toFixed(2)}`;
        equation = equation
            .replace(/x\^1/g, 'x')
            .replace(/\+\s+-/g, '- ')
            .replace(/(\d)\.0+([^\d])/g, '$1$2');

        // const denormalizedBias = bias - denormalizedWeights
        //     .slice(1)
        //     .reduce((sum, w, idx) => sum + w * min, 0);

        // let equation = `y = ${bias.toFixed(2)}`;
        // equationParts.slice(1).forEach((term, i) => {
        //     equation += ` + ${term}`;
        // });

        const predictions = xValues.map(x => ({
            x,
            y: model.predict(tf.tensor2d([addPolynomialFeatures(x, degree)], [1, degree + 1])).dataSync()[0]
        }));

        const trainingTime = (Date.now() - startTime) / 1000

        res.json({
            train_data: trainData,
            test_data: testData,
            predictions,
            equation: equation.replace(/\+ -/g, '- '),
            r2: calculateR2(testData, predictions),
            loss_function,
            test_error: calculateError(testData, predictions, loss_function),
            all_data: dataPoints,
            training_history: trainingHistory,
            saveInterval: saveInterval,
            final_model: trainingHistory[trainingHistory.length - 1],
            training_time: trainingTime
            // final_model: trainingHistory.length > 0 
            //     ? trainingHistory[trainingHistory.length - 1]
            //     : null
        });
    } catch (error) {
        console.error('Training error:', error);
        res.status(500).json({ error: error.message });
    }
});

function generateEquation(weights, bias) {
    let equation = "y = ";
    for (let i = weights.length - 1; i > 0; i--) {
      equation += `${weights[i].toFixed(2)}x^${i} + `;
    }
    equation += `${(bias + weights[0]).toFixed(2)}`;
    return equation;
}

function calculateError(testData, predictions, lossFunction) {
    let error = 0;
    for (const point of testData) {
        const pred = predictions.find(p => p.x === point.x)?.y || 0;
        if (lossFunction === "MSE") {
            error += Math.pow(pred - point.y, 2);
        } else {
            error += Math.abs(pred - point.y);
        }
    }
    return error / testData.length;
}

function calculateR2(testData, predictions) {
    const yMean = testData.reduce((sum, p) => sum + p.y, 0) / testData.length;
    let ssTotal = 0;
    let ssResidual = 0;
    for (const point of testData) {
        const pred = predictions.find(p => p.x === point.x)?.y || 0;
        ssTotal += Math.pow(point.y - yMean, 2);
        ssResidual += Math.pow(point.y - pred, 2);
    }
    return 1 - (ssResidual / ssTotal);
}

app.listen(3000, () => console.log('Server running on port 3000'));