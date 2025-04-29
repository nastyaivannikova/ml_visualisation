document.addEventListener("DOMContentLoaded", () => {
    const darkThemeIcon = document.querySelector('.dark-icon');
    const lightThemeIcon = document.querySelector('.light-icon');
    const themeToggleButtons = document.querySelectorAll('.theme-icon');

    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(`${savedTheme}-theme`);

    themeToggleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
            
            document.body.classList.remove('dark-theme', 'light-theme');
            document.body.classList.add(`${newTheme}-theme`);
            
            localStorage.setItem('theme', newTheme);
        });
    });

    const addPointBtn = document.getElementById("add-point");
    const removePointBtn = document.getElementById("remove-point");
    const resetPointsBtn = document.getElementById("reset-points");
    const trainRatioInput = document.getElementById("train-ratio");
    const testRatioInput = document.getElementById("test-ratio");
    const noiseLevelInput = document.getElementById("noise-level");
    const degreeInput = document.getElementById("degree");
    const iterationsInput = document.getElementById("iterations");
    const learningRateInput = document.getElementById("learning-rate");
    const lossMseBtn = document.getElementById("loss-mse");
    const lossMaeBtn = document.getElementById("loss-mae");
    const regularizationSelect = document.getElementById("regularization-type");
    const iterationStepInput = document.getElementById("iteration-step");
    let trainingHistory = [];
    let currentModelState = null;
    let selectedPointId = null;
    let pointsData = [];

    function updateSliderValues() {
        document.getElementById("train-ratio-value").textContent = `${trainRatioInput.value}%`;
        document.getElementById("test-ratio-value").textContent = `${testRatioInput.value}%`;
        document.getElementById("noise-level-value").textContent = noiseLevelInput.value;
        document.getElementById("degree-value").textContent = degreeInput.value;
        document.getElementById("iterations-value").textContent = iterationsInput.value;
        document.getElementById("learning-rate-value").textContent = learningRateInput.value;
        document.getElementById("current-iteration-value").textContent = iterationStepInput.value;
        document.querySelectorAll('#sin-amp, #sin-freq, #sqrt-coeff, #linear-coeff').forEach(input => {
            input.addEventListener('input', () => {
                document.getElementById(`${input.id}-value`).textContent = input.value;
                debouncedRender();
            });
        });
    }

    updateSliderValues();

    trainRatioInput.addEventListener("input", () => {
        testRatioInput.value = 100 - trainRatioInput.value;
        updateSliderValues();
        renderChart();
    });

    testRatioInput.addEventListener("input", () => {
        trainRatioInput.value = 100 - testRatioInput.value;
        updateSliderValues();
        renderChart();
    });

    noiseLevelInput.addEventListener("input", () => {
        updateSliderValues();
        renderChart();
    });

    degreeInput.addEventListener("input", () => {
        updateSliderValues();
        renderChart();
    });

    iterationsInput.addEventListener("input", () => {
        updateSliderValues();
        renderChart();
    });

    learningRateInput.addEventListener("input", () => {
        updateSliderValues();
        renderChart();
    });

    lossMseBtn.addEventListener("click", () => {
        lossMseBtn.classList.add("active");
        lossMaeBtn.classList.remove("active");
        renderChart();
    });
    
    lossMaeBtn.addEventListener("click", () => {
        lossMaeBtn.classList.add("active");
        lossMseBtn.classList.remove("active");
        renderChart();
    });

    regularizationSelect.addEventListener("change", () => {
        renderChart();
    });

    let debounceTimeout;
    const DEBOUNCE_DELAY = 500; 

    function debouncedRender() {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            fetch("http://localhost:3000/reset_points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    coefficients: {
                        sinAmplitude: parseFloat(document.getElementById('sin-amp').value),
                        sinFrequency: parseFloat(document.getElementById('sin-freq').value),
                        sqrtCoeff: parseFloat(document.getElementById('sqrt-coeff').value),
                        linearCoeff: parseFloat(document.getElementById('linear-coeff').value),
                        xMin: 0,
                        xMax: 10
                    },
                    noiseLevel: parseFloat(noiseLevelInput.value)
                })
            }).then(() => renderChart());
        }, DEBOUNCE_DELAY);
    }

    iterationStepInput.addEventListener("input", () => {
        if (!trainingHistory.length) return;
        
        const maxStep = trainingHistory.length - 1;
        const stepIndex = Math.round(iterationStepInput.value / 100 * maxStep);
        
        currentModelState = trainingHistory[stepIndex];
        document.getElementById("current-iteration-value").textContent = currentModelState.step;
        updateChartWithHistory();
    });

    addPointBtn.addEventListener("click", async () => {
        const x = parseFloat(document.getElementById("x").value);
        const y = parseFloat(document.getElementById("y").value);

        if (isNaN(x) || isNaN(y)) {
            alert("Введите корректные координаты x и y.");
            return;
        }

        try {
            const response = await fetch("http://localhost:3000/add_point", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ x, y }),
            });
            const data = await response.json();
            console.log(data.message);
            
            document.getElementById("x").value = '';
            document.getElementById("y").value = '';
            
            renderChart();
        } catch (error) {
            console.error(error);
            alert("Ошибка при добавлении точки.");
        }
    });

    noiseLevelInput.addEventListener("input", async () => {
        updateSliderValues();
        
        try {
            const coefficients = {
                sinAmplitude: parseFloat(document.getElementById('sin-amp').value),
                sinFrequency: parseFloat(document.getElementById('sin-freq').value),
                sqrtCoeff: parseFloat(document.getElementById('sqrt-coeff').value),
                linearCoeff: parseFloat(document.getElementById('linear-coeff').value)
            };
    
            await fetch("http://localhost:3000/update_noise", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    noiseLevel: parseFloat(noiseLevelInput.value),
                    coefficients: coefficients 
                })
            });
            
            renderChart();
        } catch (error) {
            console.error("Ошибка обновления шума:", error);
        }
    });

    resetPointsBtn.addEventListener("click", async () => {
        try {
            document.getElementById('sin-amp').value = 3;
            document.getElementById('sin-freq').value = 0.5;
            document.getElementById('sqrt-coeff').value = 2;
            document.getElementById('linear-coeff').value = 0;

            trainRatioInput.value = 70;
            testRatioInput.value = 30;
            noiseLevelInput.value = 0.5;
            degreeInput.value = 1;
            iterationsInput.value = 1000;
            learningRateInput.value = 0.01;
            regularizationSelect.value = "";
            
            lossMseBtn.classList.add("active");
            lossMaeBtn.classList.remove("active");
            
            updateSliderValues();
    
            const response = await fetch("http://localhost:3000/reset_points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    noiseLevel: 0.5,
                    coefficients: {
                        sinAmplitude: 3,
                        sinFrequency: 0.5,
                        sqrtCoeff: 2,
                        linearCoeff: 0
                    },
                    degree: 1 
                })
            });
            
            const data = await response.json();
            document.getElementById("x").value = '';
            document.getElementById("y").value = '';
            
            renderChart();
        } catch (error) {
            console.error(error);
            alert("Ошибка при сбросе: " + error.message);
        }
    });


    removePointBtn.addEventListener("click", async () => {
        try {
            if (selectedPointId) {
                console.log("Attempting to delete point with ID:", selectedPointId);
                
                const response = await fetch(`http://localhost:3000/delete_point/${selectedPointId}`, {
                    method: "DELETE"
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Server error:", errorData);
                    throw new Error(errorData.message || 'Failed to delete point');
                }
                
                const result = await response.json();
                console.log("Delete result:", result);
                
                pointsData = result.points;
                document.getElementById("x").value = '';
                document.getElementById("y").value = '';
                selectedPointId = null;
                await renderChart();
            } else {
                console.log("No selected point, deleting last point"); 

                const response = await fetch("http://localhost:3000/delete_last_point", {
                    method: "DELETE"
                });
                await response.json();
                await renderChart();
            }
        } catch (error) {
            console.error("Error deleting point:", error);
            alert(`Ошибка при удалении точки: ${error.message}`);
        }
    });

    function formatEquation(equation, decimals) {
        return equation
            .replace(/x\^1/g, 'x')
            .replace(/(\d+\.\d{2})\d+/g, '$1')
            .replace(/(\d)\.0+([^\d])/g, '$1$2');
    }

    function updateChartWithHistory() {
        if (!currentModelState || !window.myChart) return;
    
        window.myChart.data.datasets[2].data = currentModelState.predictions;
        
        window.myChart.options.scales.x.min = 0;
        window.myChart.options.scales.x.max = 10;
        
        window.myChart.update();
    }

    function calculateError(testData, predictions, lossFunction) {
        if (testData.length === 0) return 0;
    
        const sortedPreds = [...predictions].sort((a, b) => a.x - b.x);
        
        let error = 0;
        for (const point of testData) {
            const index = sortedPreds.findIndex(p => p.x >= point.x);
            if (index === -1 || index === 0) {
                const pred = sortedPreds[0]?.y || 0;
                error += calculateLoss(pred, point.y, lossFunction);
                continue;
            }
    
            const prev = sortedPreds[index - 1];
            const next = sortedPreds[index];
            const fraction = (point.x - prev.x) / (next.x - prev.x);
            const interpolatedY = prev.y + fraction * (next.y - prev.y);
            
            error += calculateLoss(interpolatedY, point.y, lossFunction);
        }
    
        return error / testData.length;
    }
    
    function calculateLoss(pred, actual, lossFunction) {
        return lossFunction === "MSE" 
            ? Math.pow(pred - actual, 2) 
            : Math.abs(pred - actual);
    }
    
    function calculateR2(testData, predictions) {
        if (testData.length === 0) return 0;
    
        const sortedPreds = [...predictions].sort((a, b) => a.x - b.x);
        const yMean = testData.reduce((sum, p) => sum + p.y, 0) / testData.length;
        let ssTotal = 0;
        let ssResidual = 0;
    
        for (const point of testData) {
            const index = sortedPreds.findIndex(p => p.x >= point.x);

            if (index === -1) {
                const lastPred = sortedPreds[sortedPreds.length - 1]?.y || 0;
                ssTotal += Math.pow(point.y - yMean, 2);
                ssResidual += Math.pow(point.y - lastPred, 2);
                continue;
            } else if (index === 0) {
                const firstPred = sortedPreds[0]?.y || 0;
                ssTotal += Math.pow(point.y - yMean, 2);
                ssResidual += Math.pow(point.y - firstPred, 2);
                continue;
            }
    
            const prev = sortedPreds[index - 1];
            const next = sortedPreds[index];
            const fraction = (point.x - prev.x) / (next.x - prev.x);
            const interpolatedY = prev.y + fraction * (next.y - prev.y);
    
            ssTotal += Math.pow(point.y - yMean, 2);
            ssResidual += Math.pow(point.y - interpolatedY, 2);
        }
    
        return 1 - (ssResidual / ssTotal);
    }

    async function renderChart() {
        const startTime = Date.now();
        let timerInterval;

        try {
            timerInterval = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                document.getElementById("training-time-value").textContent = 
                    `${elapsed.toFixed(1)} сек...`;
            }, 100);

            const lossFunction = lossMseBtn.classList.contains("active") ? "MSE" : "MAE";
            const coefficients = {
                sinAmplitude: parseFloat(document.getElementById('sin-amp').value),
                sinFrequency: parseFloat(document.getElementById('sin-freq').value),
                sqrtCoeff: parseFloat(document.getElementById('sqrt-coeff').value),
                linearCoeff: parseFloat(document.getElementById('linear-coeff').value)
            };

            const response = await fetch("http://localhost:3000/train_model", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    degree: parseInt(degreeInput.value),
                    noiseLevel: parseFloat(noiseLevelInput.value),
                    trainRatio: parseInt(trainRatioInput.value),
                    testRatio: parseInt(testRatioInput.value),
                    loss_function: lossFunction,
                    regularizationType: regularizationSelect.value,
                    iterations: parseInt(iterationsInput.value),
                    learningRate: parseFloat(learningRateInput.value),
                    coefficients: coefficients
                })
            });

            clearInterval(timerInterval);

            const data = await response.json();
            const ctx = document.getElementById('regression-chart').getContext('2d');

            const endTime = Date.now();
            const trainingTime = (endTime - startTime) / 1000;
            document.getElementById("training-time-value").textContent = 
                `${data.training_time?.toFixed(3) || trainingTime.toFixed(3)} сек`;

            trainingHistory = data.training_history || [];
            iterationStepInput.max = trainingHistory.length - 1;
            iterationStepInput.value = iterationStepInput.max;
            updateSliderValues();

            const regressionData = data.train_data.map(p => [p.x, p.y]);

            const degree = parseInt(degreeInput.value);
            const result = regression.polynomial(regressionData, { order: degree, precision: 10 });

            currentModelState = data.final_model || null;
            
            const regressionPredictions = Array.from({ length: 100 }, (_, i) => {
                const x = i * 0.1;
                const y = result.predict(x)[1];
                return { x, y };
            });

            const regressionEquation = result.string

            const testData = data.test_data;
            const regressionTestError = calculateError(testData, regressionPredictions, lossFunction);
            const regressionR2 = calculateR2(testData, regressionPredictions);

            if (!data.predictions) {
                console.error("Нет данных для прогноза:", data);
                return;
            }

            if (window.myChart) {
                window.myChart.destroy();
            }

            window.myChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: 'Обучающая выборка',
                            data: data.train_data,
                            backgroundColor: 'rgba(54, 162, 235, 1)',
                            pointRadius: data.train_data && data.train_data.length > 0 ? 6 : 0
                        },
                        {
                            label: 'Тестовая выборка',
                            data: data.test_data,
                            backgroundColor: 'rgba(255, 99, 132, 1)',
                            pointRadius: data.test_data && data.test_data.length > 0 ? 6 : 0
                        },
                        {
                            label: 'Прогноз (Градиентный спуск)',
                            data: data.predictions,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            type: 'line',
                            pointRadius: 0,
                            borderWidth: 2
                        },
                        {
                            label: `Прогноз (Regression)`,
                            data: regressionPredictions,
                            borderColor: 'rgba(255, 159, 64, 1)',
                            type: 'line',
                            pointRadius: 0,
                            borderWidth: 2,
                            borderDash: [5, 5]
                        }
                    ]
                },
                options: {
                    responsive: true,
                    onClick: (evt, elements) => {
                        if (elements.length > 0) {
                            const datasetIndex = elements[0].datasetIndex;
                            const index = elements[0].index;
                            
                            if (datasetIndex < 2) {
                                const point = window.myChart.data.datasets[datasetIndex].data[index];
                                selectedPointId = point.id;
                                document.getElementById("x").value = point.x;
                                document.getElementById("y").value = point.y;
                            }
                        }
                    },
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: data.equation ? 
                            [
                                `Уравнение: ${formatEquation(data.equation, 2)}`,
                                `R²: ${data.r2.toFixed(2)} | Ошибка (${lossFunction}): ${data.test_error.toFixed(2)}`,
                                `Уравнение регрессии: ${formatEquation(regressionEquation, 2)}`,
                                `R² (Регрессия): ${regressionR2.toFixed(2)} | Ошибка регрессии (${lossFunction}): ${regressionTestError.toFixed(2)}`
                            ] 
                            : ["Добавьте данные для построения модели"],
                            font: {
                                size: 16,
                                weight: 'bold',
                            },
                            color: '#808080'
                        },
                        legend: {
                            labels: {
                                font: {
                                    size: 14
                                },
                                color: '#808080'
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            min: 0,
                            max: 10
                        },
                        y: {
                            type: 'linear'
                        }
                    }
                }
            });

            ctx.canvas.onclick = function(evt) {
                const points = window.myChart.getElementsAtEventForMode(
                    evt, 
                    'nearest', 
                    { intersect: true }, 
                    true
                );
                
                if (points.length === 0) {
                    selectedPointId = null;
                    document.getElementById("x").value = '';
                    document.getElementById("y").value = '';
                }
            };
            
            

        } catch (error) {
            console.error("Ошибка при отображении графика:", error);

        } finally {
            clearInterval(timerInterval);
        }
    }

    renderChart();
});