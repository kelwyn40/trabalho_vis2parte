import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const margin = { top: 40, right: 30, bottom: 50, left: 60 };

let allData = [];
let geoData = [];
let activeFilters = {};

export function plotCharts(taxiData, mapData) {
    allData = taxiData;
    geoData = mapData;

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

    if (activeFilters.heatmap) {
        const { startDay, endDay, startHour, endHour } = activeFilters.heatmap;
        filteredData = filteredData.filter(
            (d) =>
                d.pickup_day_of_week >= startDay &&
                d.pickup_day_of_week <= endDay &&
                d.pickup_hour >= startHour &&
                d.pickup_hour <= endHour
        );
    }
    if (activeFilters.scatter) {
        const [[x0, y0], [x1, y1]] = activeFilters.scatter.selection;
        const { xScale, yScale } = activeFilters.scatter.scales;
        filteredData = filteredData.filter(
            (d) =>
                xScale.invert(x0) <= d.trip_distance &&
                d.trip_distance <= xScale.invert(x1) &&
                yScale.invert(y1) <= d.tip_amount &&
                d.tip_amount <= yScale.invert(y0)
        );
    }
    if (activeFilters.map) {
        filteredData = filteredData.filter((d) => d.PULocationID === activeFilters.map.locationID);
    }

    drawMap(filteredData);
    drawHeatmap(filteredData);
    drawScatterPlot(filteredData);
    drawBarChart(filteredData);
}

function drawMap(data) {
    const svg = d3.select("#mapChart");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;

    const pickupCounts = d3.rollup(
        data,
        (v) => v.length,
        (d) => d.PULocationID
    );

    const colorScale = d3
        .scaleSequential(d3.interpolateViridis)
        .domain([0, d3.max(Array.from(pickupCounts.values())) || 1]);

    const projection = d3.geoMercator().fitSize([width, height], geoData);
    const path = d3.geoPath().projection(projection);

    svg.append("g")
        .selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("d", path)
        .attr("class", "zone")
        .attr("fill", (d) => {
            // CORREÇÃO FINAL E ROBUSTA AQUI
            const mapIdAsNumber = parseInt(d.properties.LocationId, 10);
            const count = pickupCounts.get(mapIdAsNumber);
            return count ? colorScale(count) : "#444";
        })
        .on("click", (event, d) => {
            // CORREÇÃO FINAL E ROBUSTA AQUI
            const clickedLocationID = parseInt(d.properties.LocationId, 10);

            if (activeFilters.map && activeFilters.map.locationID === clickedLocationID) {
                delete activeFilters.map;
            } else {
                activeFilters.map = { locationID: clickedLocationID };
            }
            draw();
        })
        .append("title")
        .text((d) => {
            // CORREÇÃO FINAL E ROBUSTA AQUI
            const mapIdAsNumber = parseInt(d.properties.LocationId, 10);
            const count = pickupCounts.get(mapIdAsNumber);
            return `${d.properties.zone}\nCorridas: ${count || 0}`;
        });
}

function drawHeatmap(data) {
    const svg = d3.select("#heatmapChart");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const hours = d3.range(24);

    const xScale = d3
        .scaleBand()
        .domain(hours)
        .range([0, width - margin.left - margin.right])
        .padding(0.05);
    const yScale = d3
        .scaleBand()
        .domain(days)
        .range([0, height - margin.top - margin.bottom])
        .padding(0.05);

    const heatmapData = d3.rollup(
        data,
        (v) => v.length,
        (d) => d.pickup_day_of_week,
        (d) => d.pickup_hour
    );
    const colorScale = d3
        .scaleSequential(d3.interpolateInferno)
        .domain([0, d3.max(Array.from(heatmapData.values()), (d) => d3.max(Array.from(d.values()))) || 1]);

    g.selectAll("g.heatmap-row")
        .data(Array.from(heatmapData.entries()))
        .enter()
        .append("g")
        .attr("class", "heatmap-row")
        .selectAll("rect")
        .data((d) => Array.from(d[1].entries()).map(([hour, count]) => ({ day: d[0], hour, count })))
        .enter()
        .append("rect")
        .attr("x", (d) => xScale(d.hour))
        .attr("y", (d) => yScale(days[d.day]))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("class", "heatmap-cell")
        .style("fill", (d) => colorScale(d.count))
        .append("title")
        .text((d) => `${d.count} corridas`);

    g.append("g").call(d3.axisBottom(xScale).tickValues(xScale.domain().filter((d) => d % 3 === 0)));
    g.append("g").call(d3.axisLeft(yScale));

    const brush = d3
        .brush()
        .extent([
            [0, 0],
            [width - margin.left - margin.right, height - margin.top - margin.bottom],
        ])
        .on("end", (event) => {
            if (!event.selection) {
                delete activeFilters.heatmap;
            } else {
                const [[x0, y0], [x1, y1]] = event.selection;
                activeFilters.heatmap = {
                    startHour: Math.floor(x0 / xScale.step()),
                    endHour: Math.floor(x1 / xScale.step()),
                    startDay: Math.floor(y0 / yScale.step()),
                    endDay: Math.floor(y1 / yScale.step()),
                };
            }
            draw();
        });
    g.append("g").attr("class", "brush").call(brush);
}

function drawScatterPlot(data) {
    const svg = d3.select("#scatterPlot");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.trip_distance) || 10])
        .range([0, width - margin.left - margin.right]);
    const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.tip_amount) || 10])
        .range([height - margin.top - margin.bottom, 0]);
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    g.selectAll(".dot")
        .data(data.slice(0, 5000))
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", (d) => xScale(d.trip_distance))
        .attr("cy", (d) => yScale(d.tip_amount))
        .attr("r", (d) => (d.passenger_count || 1) * 1.5)
        .style("fill", (d) => colorScale(d.payment_type_name));

    g.append("g")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(xScale));
    g.append("g").call(d3.axisLeft(yScale));

    const brush = d3
        .brush()
        .extent([
            [0, 0],
            [width - margin.left - margin.right, height - margin.top - margin.bottom],
        ])
        .on("end", (event) => {
            if (!event.selection) {
                delete activeFilters.scatter;
            } else {
                activeFilters.scatter = { selection: event.selection, scales: { xScale, yScale } };
            }
            draw();
        });
    g.append("g").attr("class", "brush").call(brush);
}

function drawBarChart(data) {
    const svg = d3.select("#barChart");
    svg.selectAll("*").remove();
    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const paymentCounts = d3.rollup(
        data,
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
        .padding(0.1);

    g.selectAll(".bar")
        .data(paymentData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("y", (d) => yScale(d.type))
        .attr("width", (d) => xScale(d.count))
        .attr("height", yScale.bandwidth())
        .attr("fill", "var(--vibrant-purple)");

    g.append("g").call(d3.axisLeft(yScale));
    g.append("g")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(xScale).ticks(5, "s"));
}

export function clearAllCharts() {
    d3.selectAll("svg").selectAll("*").remove();
    activeFilters = {};
}
