document.addEventListener("DOMContentLoaded", () => {
  // --- Configurações Iniciais ---
  const visContainer = document.getElementById("visualization-container");
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const width = visContainer.clientWidth - margin.left - margin.right;
  const height =
    (visContainer.clientHeight > 400 ? visContainer.clientHeight : 600) -
    margin.top -
    margin.bottom;
  const K_DIM = 2;

  const svg = d3
    .select("#visualization-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  let dataPoints = [];
  let kdTree = null;
  let xScale, yScale; // Escalas D3 para responsividade

  // --- Elementos da UI ---
  const numPointsInput = document.getElementById("num-points");
  const addPointsBtn = document.getElementById("add-points-btn");
  const resetBtn = document.getElementById("reset-btn");
  const customDataInput = document.getElementById("custom-data");
  const loadCustomDataBtn = document.getElementById("load-custom-data-btn");

  const statusText = document.getElementById("status-text");
  const nodesVisitedText = document.getElementById("nodes-visited");
  const bruteForceChecksText = document.getElementById("brute-force-checks");
  const efficiencyGainText = document.getElementById("efficiency-gain");

  // --- Lógica da Árvore Kd (sem alterações) ---
  class Node {
    constructor(data, axis, left = null, right = null) {
      this.data = data;
      this.axis = axis;
      this.left = left;
      this.right = right;
    }
  }

  function buildKdTree(points, depth = 0) {
    if (points.length === 0) return null;
    const axis = depth % K_DIM;
    points.sort((a, b) => a.point[axis] - b.point[axis]);
    const medianIndex = Math.floor(points.length / 2);

    return new Node(
      points[medianIndex],
      axis,
      buildKdTree(points.slice(0, medianIndex), depth + 1),
      buildKdTree(points.slice(medianIndex + 1), depth + 1)
    );
  }

  // --- Lógica da Busca (sem alterações) ---
  let nodesVisitedCount = 0;
  function findNearestNeighbor(node, target, depth = 0) {
    if (node === null) return { data: null, distance: Infinity };
    nodesVisitedCount++;
    const axis = depth % K_DIM;
    let nextBranch =
      target[axis] < node.data.point[axis] ? node.left : node.right;
    let oppositeBranch =
      target[axis] < node.data.point[axis] ? node.right : node.left;
    let best = findNearestNeighbor(nextBranch, target, depth + 1);
    const currentDist = euclideanDistance(target, node.data.point);
    if (currentDist < best.distance) {
      best = { data: node.data, distance: currentDist };
    }
    const distToPlane = Math.abs(target[axis] - node.data.point[axis]);
    if (distToPlane < best.distance) {
      const oppositeBest = findNearestNeighbor(
        oppositeBranch,
        target,
        depth + 1
      );
      if (oppositeBest.distance < best.distance) best = oppositeBest;
    }
    return best;
  }

  function euclideanDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
  }

  // --- Lógica da Visualização (Atualizada com escalas) ---
  function drawScene() {
    svg.selectAll("*").remove();

    if (kdTree) {
      drawTreePartitions(
        kdTree,
        xScale.domain()[0],
        yScale.domain()[0],
        xScale.domain()[1],
        yScale.domain()[1]
      );
    }

    const g = svg.append("g");

    g.selectAll("circle.data-point")
      .data(dataPoints)
      .enter()
      .append("circle")
      .attr("class", "data-point")
      .attr("cx", (d) => xScale(d.point[0]))
      .attr("cy", (d) => yScale(d.point[1]))
      .attr("r", 5)
      .attr("fill", "#4A5568")
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1);
        tooltip
          .html(
            `<strong>${d.label}</strong><br>(${d.point[0].toFixed(
              1
            )}, ${d.point[1].toFixed(1)})`
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    g.selectAll("text.label")
      .data(dataPoints)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", (d) => xScale(d.point[0]) + 8)
      .attr("y", (d) => yScale(d.point[1]) + 4)
      .text((d) => d.label)
      .attr("font-size", "11px")
      .attr("fill", "#2D3748");
  }

  function drawTreePartitions(node, x_min, y_min, x_max, y_max) {
    if (node === null) return;

    const axis = node.axis;
    const point = node.data.point;
    const line = svg
      .append("line")
      .style("stroke", "#63B3ED")
      .style("stroke-width", 1)
      .style("stroke-dasharray", "4");

    if (axis === 0) {
      // Divisão vertical
      line
        .attr("x1", xScale(point[0]))
        .attr("y1", yScale(y_min))
        .attr("x2", xScale(point[0]))
        .attr("y2", yScale(y_max));
      drawTreePartitions(node.left, x_min, y_min, point[0], y_max);
      drawTreePartitions(node.right, point[0], y_min, x_max, y_max);
    } else {
      // Divisão horizontal
      line
        .attr("x1", xScale(x_min))
        .attr("y1", yScale(point[1]))
        .attr("x2", xScale(x_max))
        .attr("y2", yScale(point[1]));
      drawTreePartitions(node.left, x_min, y_min, x_max, point[1]);
      drawTreePartitions(node.right, x_min, point[1], x_max, y_max);
    }
  }

  function highlightSearch(queryData, nearestData) {
    svg.selectAll("circle.query-point, circle.nearest-neighbor").remove();

    svg
      .append("circle")
      .attr("class", "query-point")
      .attr("cx", xScale(queryData[0]))
      .attr("cy", yScale(queryData[1]))
      .attr("r", 8)
      .attr("fill", "none")
      .attr("stroke", "#38A169")
      .attr("stroke-width", 3);

    if (nearestData && nearestData.point) {
      svg
        .append("circle")
        .attr("class", "nearest-neighbor")
        .attr("cx", xScale(nearestData.point[0]))
        .attr("cy", yScale(nearestData.point[1]))
        .attr("r", 8)
        .attr("fill", "none")
        .attr("stroke", "#E53E3E")
        .attr("stroke-width", 3);
    }
  }

  function parseCustomData(text) {
    const points = [];
    const lines = text.trim().split("\n");
    const regex =
      /"([^"]+)"\s*→\s*\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        points.push({
          label: match[1],
          point: [parseFloat(match[2]), parseFloat(match[4])],
        });
      }
    }
    return points;
  }

  // --- Manipuladores de Eventos (Atualizados com escalas) ---
  function buildAndDraw(points) {
    if (points.length === 0) {
      statusText.textContent = "Nenhum ponto para construir a árvore.";
      return;
    }
    dataPoints = points;

    // --- NOVO: Define as escalas com base nos dados ---
    const xExtent = d3.extent(dataPoints, (d) => d.point[0]);
    const yExtent = d3.extent(dataPoints, (d) => d.point[1]);

    const xPadding = (xExtent[1] - xExtent[0]) * 0.1 || 10;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 10;

    xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, width]);

    yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([height, 0]); // Invertido para o sistema de coordenadas do SVG

    kdTree = buildKdTree(dataPoints.slice());
    drawScene();
    statusText.textContent =
      "Árvore construída. Clique na área para consultar.";
    bruteForceChecksText.textContent = dataPoints.length;
    nodesVisitedText.textContent = "N/A";
    efficiencyGainText.textContent = "N/A";
  }

  addPointsBtn.addEventListener("click", () => {
    const num = parseInt(numPointsInput.value, 10);
    const randomPoints = [];
    for (let i = 0; i < num; i++) {
      randomPoints.push({
        label: `P${i + 1}`,
        point: [Math.random() * 1000, Math.random() * 1000],
      });
    }
    buildAndDraw(randomPoints);
  });

  loadCustomDataBtn.addEventListener("click", () => {
    const customPoints = parseCustomData(customDataInput.value);
    if (customPoints.length > 0) {
      buildAndDraw(customPoints);
    } else {
      statusText.textContent = "Dados inválidos. Verifique o formato.";
    }
  });

  resetBtn.addEventListener("click", () => {
    dataPoints = [];
    kdTree = null;
    svg.selectAll("*").remove();
    statusText.textContent = "Aguardando pontos...";
    nodesVisitedText.textContent = "N/A";
    bruteForceChecksText.textContent = "N/A";
    efficiencyGainText.textContent = "N/A";
    customDataInput.value = "";
  });

  svg.on("click", (event) => {
    if (!kdTree) {
      statusText.textContent = "Construa a árvore primeiro!";
      return;
    }

    const [screenX, screenY] = d3.pointer(event);
    // --- NOVO: Converte coordenadas da tela para coordenadas dos dados ---
    const queryPointData = [xScale.invert(screenX), yScale.invert(screenY)];

    statusText.textContent = "Executando busca...";

    setTimeout(() => {
      nodesVisitedCount = 0;
      const nearestResult = findNearestNeighbor(kdTree, queryPointData);

      drawScene();
      highlightSearch(queryPointData, nearestResult.data);

      nodesVisitedText.textContent = nodesVisitedCount;
      const gain =
        dataPoints.length > 0
          ? (1 - nodesVisitedCount / dataPoints.length) * 100
          : 0;
      efficiencyGainText.textContent = `${gain.toFixed(1)}%`;
      statusText.textContent = "Busca concluída.";
    }, 100);
  });

  // --- Inicialização ---
  function initializeWithSampleData() {
    const sampleData = [
      '"casa" → (15, 80)',
      '"caso" → (20, 70)',
      '"caos" → (25, 65)',
      '"data" → (40, 30)',
      '"gato" → (35, 15)',
      '"testa" → (70, 50)',
      '"teste" → (65, 55)',
      '"dados" → (45, 25)',
      '"seguro" → (80, 90)',
      '"senha" → (75, 85)',
    ].join("\n");
    customDataInput.value = sampleData;
    loadCustomDataBtn.click();
  }

  initializeWithSampleData();
});
