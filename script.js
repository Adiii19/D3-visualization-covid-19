const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
const tooltip = d3.select("#tooltip");

const projection = d3.geoMercator()
  .scale(130)
  .translate([width / 2, height / 1.5]);

const path = d3.geoPath().projection(projection);
const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 40000000]);

Promise.all([
  d3.json("data/countries-110m.json"),
  d3.csv("data/owid-covid-data.csv")
]).then(([worldData, covidData]) => {
  const countries = topojson.feature(worldData, worldData.objects.countries).features;

  const covidMap = {};
  covidData.forEach(d => {
    if (!covidMap[d.location] || +d.total_cases > covidMap[d.location]) {
      covidMap[d.location] = +d.total_cases;
    }
  });

  svg.selectAll("path")
    .data(countries)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", d => {
      const countryName = d.properties.name;
      const cases = covidMap[countryName] || 0;
      return colorScale(cases);
    })
    .attr("stroke", "#999")
    .on("mouseover", (event, d) => {
      const name = d.properties.name;
      const cases = covidMap[name] || 0;
      tooltip
        .style("visibility", "visible")
        .html(`<strong>${name}</strong><br>Total Cases: ${cases.toLocaleString()}`);
      d3.select(event.currentTarget).attr("fill", "orange");
    })
    .on("mousemove", event => {
      tooltip
        .style("top", (event.pageY - 20) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", (event, d) => {
      const name = d.properties.name;
      const cases = covidMap[name] || 0;
      d3.select(event.currentTarget).attr("fill", colorScale(cases));
      tooltip.style("visibility", "hidden");
    });

  // Populate dropdown
  const countriesList = Array.from(new Set(covidData.map(d => d.location))).sort();
  const countrySelect = d3.select("#country-select");
  countriesList.forEach(c => {
    countrySelect.append("option").text(c).attr("value", c);
  });

  // Bar Chart
  const barSvg = d3.select("#bar-chart");
  const barMargin = { top: 20, right: 20, bottom: 40, left: 100 };
  const barWidth = +barSvg.attr("width") - barMargin.left - barMargin.right;
  const barHeight = +barSvg.attr("height") - barMargin.top - barMargin.bottom;
  const barG = barSvg.append("g").attr("transform", `translate(${barMargin.left},${barMargin.top})`);

  const sortedData = Object.entries(covidMap)
    .map(([country, cases]) => ({ country, cases }))
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 10);

  const yBar = d3.scaleBand()
    .domain(sortedData.map(d => d.country))
    .range([0, barHeight])
    .padding(0.1);

  const xBar = d3.scaleLinear()
    .domain([0, d3.max(sortedData, d => d.cases)])
    .range([0, barWidth]);

  barG.selectAll("rect")
    .data(sortedData)
    .enter()
    .append("rect")
    .attr("y", d => yBar(d.country))
    .attr("width", d => xBar(d.cases))
    .attr("height", yBar.bandwidth())
    .attr("fill", "crimson");

  barG.append("g").call(d3.axisLeft(yBar));
  barG.append("g")
    .attr("transform", `translate(0,${barHeight})`)
    .call(d3.axisBottom(xBar).ticks(5));

  // Line Chart: Setup
  const lineSvg = d3.select("#line-chart");
  const margin = { top: 20, right: 30, bottom: 30, left: 50 };
  const lineWidth = +lineSvg.attr("width") - margin.left - margin.right;
  const lineHeight = +lineSvg.attr("height") - margin.top - margin.bottom;
  const lineG = lineSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleTime().range([0, lineWidth]);
  const yScale = d3.scaleLinear().range([lineHeight, 0]);
  const line = d3.line()
    .x(d => xScale(new Date(d.date)))
    .y(d => yScale(d.value));

  function updateLineChart() {
    const selectedCountries = Array.from(document.getElementById("country-select").selectedOptions).map(opt => opt.value);
    const metric = document.getElementById("metric-select").value;

    const countrySeries = selectedCountries.map(country => {
      const values = covidData
        .filter(d => d.location === country && d[metric])
        .map(d => ({ date: d.date, value: +d[metric] }));
      return { country, values };
    });

    if (countrySeries.length === 0) return;

    const allValues = countrySeries.flatMap(s => s.values);
    xScale.domain(d3.extent(allValues, d => new Date(d.date)));
    yScale.domain([0, d3.max(allValues, d => d.value)]);

    lineG.selectAll("*").remove();

    lineG.append("g")
      .attr("transform", `translate(0,${lineHeight})`)
      .call(d3.axisBottom(xScale));

    lineG.append("g").call(d3.axisLeft(yScale));

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    countrySeries.forEach((series, i) => {
      lineG.append("path")
        .datum(series.values)
        .attr("fill", "none")
        .attr("stroke", color(i))
        .attr("stroke-width", 2)
        .attr("d", line);

      // Add legend
      lineG.append("text")
        .attr("x", 10)
        .attr("y", 20 + i * 20)
        .style("fill", color(i))
        .text(series.country);
    });
  }

  d3.select("#country-select").on("change", updateLineChart);
  d3.select("#metric-select").on("change", updateLineChart);
});
