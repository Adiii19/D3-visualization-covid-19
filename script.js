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

  // Simplify: Get latest total cases per country
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
});
