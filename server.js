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
function generateDataWithNoise(numPoints = 50, degree = 1, noiseLevel = 0.5) {
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
    dataPoints = generateDataWithNoise(50, degree, noiseLevel);
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

        let history = [];

        // Обучение
        await model.fit(
            tf.tensor2d(trainXs, [trainXs.length, degree + 1]),
            tf.tensor2d(trainYs, [trainYs.length, 1]),
            { 
                epochs: iterations,
                batchSize: trainXs.length,
                validationSplit: 0.2,
                // callbacks: {
                //     onEpochEnd: async (epoch, logs) => {
                //         if (!logs.val_loss) return;
                //         history.push(logs.val_loss);
                        
                //         if (history.length > 5) {
                //             const lastFive = history.slice(-5);
                //             if (Math.max(...lastFive) - Math.min(...lastFive) < 0.001) {
                //                 model.stopTraining = true;
                //             }
                //         }
                //     }
                // }
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

        const xValues = Array.from({ length: 100 }, (_, i) => i * 0.1);
        const predictions = xValues.map(x => ({
            x,
            y: model.predict(tf.tensor2d([addPolynomialFeatures(x, degree)], [1, degree + 1])).dataSync()[0]
        }));

        res.json({
            train_data: trainData,
            test_data: testData,
            predictions,
            equation: equation.replace(/\+ -/g, '- '),
            r2: calculateR2(testData, predictions),
            loss_function,
            test_error: calculateError(testData, predictions, loss_function),
            all_data: dataPoints
        });
    } catch (error) {
        console.error('Training error:', error);
        res.status(500).json({ error: error.message });
    }
});

function calculateError(testData, predictions, lossFunction = 'MSE') {
    let error = 0;
    testData.forEach(point => {
        const pred = predictions.find(p => Math.abs(p.x - point.x) < 0.1);
        if (pred) {
            const diff = point.y - pred.y;
            error += lossFunction === 'MAE' ? Math.abs(diff) : diff * diff;
        }
    });
    return lossFunction === 'MAE' ? error / testData.length : Math.sqrt(error / testData.length);
}

function calculateR2(testData, predictions) {
    const actualValues = testData.map(p => p.y);
    const predictedValues = testData.map(point => {
        const pred = predictions.find(p => Math.abs(p.x - point.x) < 0.1);
        return pred ? pred.y : 0;
    });

    const meanActual = actualValues.reduce((sum, val) => sum + val, 0) / actualValues.length;
        const sst = actualValues.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
    
    const ssr = actualValues.reduce((sum, val, idx) => 
        sum + Math.pow(val - predictedValues[idx], 2), 0);

    return sst === 0 ? 1 : 1 - (ssr / sst);
}

app.listen(3000, () => console.log('Server running on port 3000'));