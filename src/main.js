import { Taxi } from "./taxi.js";
import { plotCharts, clearAllCharts } from "./plot.js";

async function main() {
    const taxi = new Taxi();
    const loadingIndicator = document.querySelector("#loadingIndicator");
    const loadBtn = document.querySelector("#loadBtn");
    const clearBtn = document.querySelector("#clearBtn");

    let taxiData = null;

    loadBtn.disabled = true;

    loadBtn.addEventListener("click", () => {
        if (taxiData) {
            plotCharts(taxiData);
        } else {
            console.error("Dados ainda não foram carregados.");
        }
    });

    clearBtn.addEventListener("click", clearAllCharts);

    try {
        loadingIndicator.style.display = "block";

        await taxi.init();
        await taxi.loadTaxi(3);

        taxiData = await taxi.query(`
            SELECT
                CAST(strftime(lpep_pickup_datetime, '%w') AS INTEGER) AS pickup_day_of_week,
                CAST(strftime(lpep_pickup_datetime, '%H') AS INTEGER) AS pickup_hour,
                trip_distance,
                tip_amount,
                passenger_count,
                payment_type
            FROM taxi_2023
            WHERE trip_distance > 0 AND trip_distance < 50
              AND tip_amount >= 0 AND tip_amount < 100
              AND passenger_count > 0
              AND payment_type IS NOT NULL;
        `);

        console.log("Dados carregados com sucesso.");

        loadBtn.disabled = false;
        loadBtn.textContent = "Recarregar Gráficos";
        loadingIndicator.style.display = "none";

        plotCharts(taxiData);
    } catch (error) {
        console.error("Erro na inicialização ou carregamento dos dados:", error);
        loadingIndicator.textContent = "Erro ao carregar dados. Verifique o console.";
        loadingIndicator.style.color = "red";
    }
}

window.onload = main;
