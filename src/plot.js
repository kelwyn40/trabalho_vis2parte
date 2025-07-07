import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const margin = { top: 40, right: 30, bottom: 50, left: 60 };
const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

let allData = [];
let activeFilters = {};

export function plotCharts(taxiData) {
    allData = taxiData;

    const paymentTypeMap = {
        1: "Cartão",
        2: "Dinheiro",
        3: "Sem Carga",
        4: "Disputa",
        5: "Desconhecido",
        6: "Viagem Anulada",
    };
    allData.forEach((d) => {
        d.payment_type_name = paymentTypeMap[d.payment_type] || "Outro";
    });

    activeFilters = {};
    draw();
}

function draw() {
    let filteredData = allData;

    if (activeFilters.dayOfWeek !== undefined) {
        filteredData = filteredData.filter((d) => d.pickup_day_of_week === activeFilters.dayOfWeek);
    }

    drawDayOfWeekChart(allData);
    drawHeatmap(filteredData);
    drawScatterPlot(filteredData);
    drawBarChart(filteredData);
}

function drawDayOfWeekChart(data) {
    const svg = d3.select("#dayOfWeekChart");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const dayCounts = d3.rollup(
        data,
        (v) => v.length,
        (d) => d.pickup_day_of_week
    );
    const dayData = Array.from(dayCounts, ([key, value]) => ({ day: key, count: value })).sort((a, b) => a.day - b.day);

    const xScale = d3
        .scaleBand()
        .domain(daysOfWeek)
        .range([0, width - margin.left - margin.right])
        .padding(0.2);

    const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(dayData, (d) => d.count) || 1])
        .range([height - margin.top - margin.bottom, 0]);

    const dataMap = new Map(dayData.map((d) => [d.day, d.count]));

    g.selectAll(".day-bar")
        .data(d3.range(7))
        .join("rect")
        .attr("class", "day-bar")
        .attr("x", (d) => xScale(daysOfWeek[d]))
        .attr("y", (d) => yScale(dataMap.get(d) || 0))
        .attr("width", xScale.bandwidth())
        .attr("height", (d) => height - margin.top - margin.bottom - yScale(dataMap.get(d) || 0))
        .attr("fill", "var(--vibrant-purple)")
        .classed("selected", (d) => d === activeFilters.dayOfWeek)
        .on("click", (event, d) => {
            if (activeFilters.dayOfWeek === d) {
                delete activeFilters.dayOfWeek;
            } else {
                activeFilters.dayOfWeek = d;
            }
            draw();
        })
        .append("title")
        .text((d) => `${(dataMap.get(d) || 0).toLocaleString("pt-BR")} corridas`);

    g.append("g").call(d3.axisLeft(yScale).ticks(5, "s"));
    g.append("g")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(xScale));
}

function drawHeatmap(data) {
    const svg = d3.select("#heatmapChart");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const hours = d3.range(24);

    const xScale = d3
        .scaleBand()
        .domain(hours)
        .range([0, width - margin.left - margin.right])
        .padding(0.01);
    const yScale = d3
        .scaleBand()
        .domain(daysOfWeek)
        .range([0, height - margin.top - margin.bottom])
        .padding(0.01);

    const heatmapData = d3.rollup(
        data,
        (v) => v.length,
        (d) => daysOfWeek[d.pickup_day_of_week],
        (d) => d.pickup_hour
    );
    const maxCount = d3.max(Array.from(heatmapData.values()), (d) => d3.max(Array.from(d.values()))) || 1;
    const colorScale = d3.scaleSequentialSqrt(d3.interpolateInferno).domain([0, maxCount]);

    g.selectAll()
        .data(data, (d) => `${d.pickup_day_of_week}:${d.pickup_hour}`)
        .enter()
        .append("rect")
        .attr("x", (d) => xScale(d.pickup_hour))
        .attr("y", (d) => yScale(daysOfWeek[d.pickup_day_of_week]))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .style("fill", (d) => {
            const dayMap = heatmapData.get(daysOfWeek[d.pickup_day_of_week]);
            const count = dayMap ? dayMap.get(d.pickup_hour) : 0;
            return colorScale(count || 0);
        })
        .append("title")
        .text((d) => {
            const dayMap = heatmapData.get(daysOfWeek[d.pickup_day_of_week]);
            const count = dayMap ? dayMap.get(d.pickup_hour) : 0;
            return `${count || 0} corridas`;
        });

    g.append("g").call(d3.axisBottom(xScale).tickValues(xScale.domain().filter((d) => d % 3 === 0)));
    g.append("g").call(d3.axisLeft(yScale));
}

function drawScatterPlot(data) {
    const svg = d3.select("#scatterPlot");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.trip_distance) || 50])
        .range([0, width - margin.left - margin.right]);
    const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.tip_amount) || 100])
        .range([height - margin.top - margin.bottom, 0]);

    g.selectAll(".dot")
        .data(data.slice(0, 5000))
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", (d) => xScale(d.trip_distance))
        .attr("cy", (d) => yScale(d.tip_amount))
        .attr("r", (d) => (d.passenger_count || 1) * 1.5)
        .style("fill", "var(--vibrant-purple)")
        .style("opacity", 0.5);

    g.append("g")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("fill", "var(--text-light)")
        .attr("x", width - margin.left - margin.right)
        .attr("y", -6)
        .attr("text-anchor", "end")
        .text("Distância (milhas)");

    g.append("g")
        .call(d3.axisLeft(yScale))
        .append("text")
        .attr("fill", "var(--text-light)")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "0.71em")
        .attr("text-anchor", "end")
        .text("Gorjeta ($)");
}

function drawBarChart(data) {
    const svg = d3.select("#barChart");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const filteredPaymentData = data.filter(
        (d) => d.payment_type_name === "Cartão" || d.payment_type_name === "Dinheiro"
    );

    const paymentCounts = d3.rollup(
        filteredPaymentData,
        (v) => v.length,
        (d) => d.payment_type_name
    );
    const paymentData = Array.from(paymentCounts, ([key, value]) => ({ type: key, count: value })).sort((a, b) =>
        d3.descending(a.count, b.count)
    );

    const xScale = d3
        .scaleLinear()
        .domain([0, d3.max(paymentData, (d) => d.count) || 1])
        .range([0, width - margin.left - margin.right]);

    const yScale = d3
        .scaleBand()
        .domain(paymentData.map((d) => d.type))
        .range([0, height - margin.top - margin.bottom])
        .padding(0.2);

    g.selectAll(".bar")
        .data(paymentData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("y", (d) => yScale(d.type))
        .attr("width", (d) => xScale(d.count))
        .attr("height", yScale.bandwidth())
        .attr("fill", "var(--vibrant-purple)")
        .append("title")
        .text((d) => `${d.count.toLocaleString("pt-BR")} corridas`);

    g.append("g").call(d3.axisLeft(yScale));
    g.append("g")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(xScale).ticks(5, "s"));
}
