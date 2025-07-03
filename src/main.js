import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm"; // <-- Esta é a linha adicionada
import { Taxi } from "./taxi.js";
import { loadDailyRideCountChart, loadTipAmountByTimeChart, clearAllCharts, loadWeekdayWeekendChart } from "./plot.js";

let allTaxiData = null; // Variável para armazenar todos os dados originais

function callbacks(data) {
    const loadBtn = document.querySelector("#loadBtn");
    const clearBtn = document.querySelector("#clearBtn");
    const loadingIndicator = document.querySelector("#loadingIndicator"); // Seleciona o indicador

    if (!loadBtn || !clearBtn || !loadingIndicator) { // Inclui o indicador na verificação
        console.error("Botões ou indicador de carregamento não encontrados.");
        return;
    }

    // Armazena os dados originais ao iniciar o callback
    allTaxiData = data;

    loadBtn.addEventListener("click", async () => {
        clearAllCharts(); // Limpa todos os gráficos e o filtro atual
        // Remove a seleção de todos os círculos ao recarregar, garantindo um estado limpo
        d3.select("#dailyRideCountChart").selectAll("circle").classed("selected", false);

        loadingIndicator.style.display = 'block'; // Mostra o indicador
        try {
            // Passe os dados originais para a função de plotagem inicial
            await loadDailyRideCountChart(allTaxiData);
            await loadTipAmountByTimeChart(allTaxiData);
            await loadWeekdayWeekendChart(allTaxiData);
        } catch (error) {
            console.error("Erro ao carregar gráficos:", error);
            // Você pode adicionar um elemento na UI para mostrar mensagens de erro ao usuário
        } finally {
            loadingIndicator.style.display = 'none'; // Esconde o indicador ao finalizar (sucesso ou erro)
        }
    });

    clearBtn.addEventListener("click", async () => {
        clearAllCharts(); // Limpa todos os gráficos e o filtro atual
        // Remove a seleção de todos os círculos ao limpar
        d3.select("#dailyRideCountChart").selectAll("circle").classed("selected", false);
    });
}

window.onload = async () => {
    const taxi = new Taxi();

    try {
        await taxi.init();
        await taxi.loadTaxi();

        const sql = `
            SELECT
                lpep_pickup_datetime,
                trip_distance,
                tip_amount,
                -- Extrair dia da semana (0=Domingo, 1=Segunda, ..., 6=Sábado)
                CAST(strftime(lpep_pickup_datetime, '%w') AS INTEGER) AS pickup_day_of_week,
                -- Extrair hora (00-23)
                CAST(strftime(lpep_pickup_datetime, '%H') AS INTEGER) AS pickup_hour
            FROM
                taxi_2023
            `;

        const data = await taxi.query(sql);
        callbacks(data); // Passa os dados para a função de callbacks para serem armazenados
    } catch (error) {
        console.error("Erro na inicialização ou carregamento dos dados do táxi:", error);
        // Exiba uma mensagem de erro na UI se a carga inicial falhar
        const loadingIndicator = document.querySelector("#loadingIndicator");
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = 'Erro ao carregar dados. Verifique o console para mais detalhes.';
            loadingIndicator.style.color = 'red';
        }
    }
};