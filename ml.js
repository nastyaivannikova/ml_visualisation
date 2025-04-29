document.addEventListener("DOMContentLoaded", () => {
    // Элементы управления
    const addPointBtn = document.getElementById("add-point");
    const removePointBtn = document.getElementById("remove-point");
    const resetPointsBtn = document.getElementById("reset-points");
    const trainRatioInput = document.getElementById("train-ratio");
    const noiseLevelInput = document.getElementById("noise-level");
    const degreeInput = document.getElementById("degree");
    const iterationsInput = document.getElementById("iterations");
    const learningRateInput = document.getElementById("learning-rate");
  
    // Обновление значений ползунков
    trainRatioInput.addEventListener("input", () => {
      document.getElementById("train-ratio-value").textContent = `${trainRatioInput.value}%`;
    });
  
    noiseLevelInput.addEventListener("input", () => {
      document.getElementById("noise-level-value").textContent = noiseLevelInput.value;
    });
  
    degreeInput.addEventListener("input", () => {
      document.getElementById("degree-value").textContent = degreeInput.value;
    });
  
    iterationsInput.addEventListener("input", () => {
      document.getElementById("iterations-value").textContent = iterationsInput.value;
    });
  
    learningRateInput.addEventListener("input", () => {
      document.getElementById("learning-rate-value").textContent = learningRateInput.value;
    });
  
    // Добавление точки
    addPointBtn.addEventListener("click", async () => {
      const x = parseFloat(document.getElementById("x").value);
      const y = parseFloat(document.getElementById("y").value);
  
      if (isNaN(x) || isNaN(y)) {
        alert("Введите корректные координаты x и y.");
        return;
      }
  
      try {
        const response = await fetch("/add_point", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x, y }),
        });
        const data = await response.json();
        console.log(data.message);
        alert(data.message);
        renderChart(); // Перерисовать график
      } catch (error) {
        console.error(error);
        alert("Ошибка при добавлении точки.");
      }
    });
  
    // Удаление точки
    removePointBtn.addEventListener("click", async () => {
      const index = prompt("Введите индекс точки для удаления:");
      
      if (isNaN(index)) {
        alert("Введите корректный индекс.");
        return;
      }
  
      try {
        const response = await fetch(`/delete_point/${index}`, { method: "DELETE" });
        const data = await response.json();
        console.log(data.message);
        alert(data.message);
        renderChart(); // Перерисовать график
      } catch (error) {
        console.error(error);
        alert("Ошибка при удалении точки.");
      }
    });
  
    // Сброс всех точек
    resetPointsBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/reset_points", { method: "POST" });
        const data = await response.json();
        console.log(data.message);
        alert(data.message);
        renderChart(); // Перерисовать график
      } catch (error) {
        console.error(error);
        alert("Ошибка при сбросе точек.");
      }
    });
  
    // Функция для перерисовки графика
    async function renderChart() {
      try {
        const response = await fetch("/train_model", { method: "POST" });
        const data = await response.json();
  
        // Используйте библиотеку Chart.js или другую для визуализации данных
        console.log(data);
        
        // Здесь вы можете обновить canvas с ID "regression-chart"
        
      } catch (error) {
        console.error(error);
        alert("Ошибка при обучении модели.");
      }
    }
  });
  