import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { Taxi } from "./taxi.js";
import { plotCharts, clearAllCharts } from "./plot.js";

async function main() {
    const taxi = new Taxi();
    const loadingIndicator = document.querySelector("#loadingIndicator");
    const loadBtn = document.querySelector("#loadBtn");
    const clearBtn = document.querySelector("#clearBtn");

    let taxiData = null;
    let geoData = null;

    loadBtn.addEventListener("click", () => {
        if (taxiData && geoData) {
            plotCharts(taxiData, geoData);
        } else {
            console.error("Dados ainda não foram carregados.");
        }
    });

    clearBtn.addEventListener("click", clearAllCharts);

    try {
        loadingIndicator.style.display = "block";

        // Iniciar o carregamento de ambos os dados em paralelo
        await taxi.init();
        await taxi.loadTaxi(3); // Carregar 3 meses para um bom volume de dados

        const taxiDataPromise = taxi.query(`
            SELECT
                CAST(strftime(lpep_pickup_datetime, '%w') AS INTEGER) AS pickup_day_of_week,
                CAST(strftime(lpep_pickup_datetime, '%H') AS INTEGER) AS pickup_hour,
                trip_distance,
                tip_amount,
                passenger_count,
                CAST(PULocationID AS INTEGER) AS PULocationID,
                payment_type
            FROM taxi_2023
            WHERE trip_distance > 0 AND trip_distance < 50
              AND tip_amount >= 0 AND tip_amount < 100
              AND passenger_count > 0
              AND PULocationID IS NOT NULL
              AND payment_type IS NOT NULL;
        `);

        const geoDataPromise = d3.json("data/nyc_taxi_zones.geojson");

        // Aguardar a conclusão de ambos
        [taxiData, geoData] = await Promise.all([taxiDataPromise, geoDataPromise]);

        // ===================================================================
        // ETAPA DE NORMALIZAÇÃO DE DADOS (CORREÇÃO CRÍTICA)
        // Garante que o ID do táxi seja sempre um número padrão, não um 'bigint'.
        // ===================================================================
        taxiData.forEach((d) => {
            d.PULocationID = Number(d.PULocationID);
        });

        console.log("Dados carregados e normalizados com sucesso.");

        loadBtn.disabled = false;
        loadBtn.textContent = "Carregar Gráficos";
        loadingIndicator.style.display = "none";

        plotCharts(taxiData, geoData);
    } catch (error) {
        console.error("Erro na inicialização ou carregamento dos dados:", error);
        loadingIndicator.textContent = "Erro ao carregar dados. Verifique o console.";
        loadingIndicator.style.color = "red";
    }
}

window.onload = main;
