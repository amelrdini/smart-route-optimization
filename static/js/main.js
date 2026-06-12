var startPoint = [-7.275788, 112.793982];

var map = L.map('map').setView(startPoint, 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OSM'
}).addTo(map);

// Add PENS as start point dengan styling khusus
var pensMarker = L.marker(startPoint, {
    icon: L.divIcon({
        html: `<div style="
            background: linear-gradient(135deg, #0066cc, #0052a3);
            color: white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            text-align: center;
            line-height: 40px;
            font-weight: bold;
            font-size: 18px;
            box-shadow: 0 4px 12px rgba(0, 102, 204, 0.4);
            border: 3px solid white;">
            🚐
        </div>`,
        iconSize: [40, 40],
        className: 'pens-marker'
    })
}).addTo(map).bindPopup("<strong>Kampus PENS (Start & End)</strong>");

var points = [];
var layers = [];
var numberMarkers = [];
var routeData = {};

// Chart instances
var comparisonChart = null;
var efficiencyChart = null;

// ===== TAB SWITCHING =====
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'dashboard') {
        loadDashboard();
    }
}

// ===== MANUAL ROUTE FUNCTIONS =====

function addPoint() {
    var lat = parseFloat(document.getElementById("lat").value);
    var lng = parseFloat(document.getElementById("lng").value);
    var bbm = parseFloat(document.getElementById("bbm").value);
    var macet = parseFloat(document.getElementById("macet").value);
    var risiko = parseFloat(document.getElementById("risiko").value);

    if (isNaN(lat) || isNaN(lng) || isNaN(bbm) || isNaN(macet) || isNaN(risiko)) {
        alert("Semua input harus diisi!");
        return;
    }

    points.push({
        lat: lat,
        lng: lng,
        bbm: bbm,
        macet: macet,
        risiko: risiko
    });

    // Add marker dengan nomor
    var marker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: `<div style="
                background: #f0f0f0;
                border: 2px solid #ddd;
                color: #333;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                text-align: center;
                line-height: 32px;
                font-weight: bold;
                font-size: 12px;">
                📍
            </div>`,
            iconSize: [32, 32]
        })
    }).addTo(map);

    updateTable();

    document.getElementById("lat").value = "";
    document.getElementById("lng").value = "";
    document.getElementById("bbm").value = "";
    document.getElementById("macet").value = "";
    document.getElementById("risiko").value = "";
}

function updateTable() {
    var tbody = document.getElementById("tbody");
    tbody.innerHTML = "";

    for (let i = 0; i < points.length; i++) {
        tbody.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td>${points[i].lat.toFixed(4)}</td>
                <td>${points[i].lng.toFixed(4)}</td>
                <td>${points[i].bbm.toFixed(2)}</td>
                <td>${points[i].macet.toFixed(2)}</td>
                <td>${points[i].risiko.toFixed(2)}</td>
            </tr>
        `;
    }
}

function updateOptimTable(route) {
    var tbody = document.getElementById("optTable");
    tbody.innerHTML = "";

    // Row 0 adalah start point (PENS)
    tbody.innerHTML += `
        <tr style="background: #e8f4f8; font-weight: bold;">
            <td>0</td>
            <td>${route[0].lat.toFixed(4)}</td>
            <td>${route[0].lng.toFixed(4)}</td>
        </tr>
    `;

    // Rows 1 sampai length-2 adalah intermediate points
    for (let i = 1; i < route.length - 1; i++) {
        tbody.innerHTML += `
            <tr>
                <td>${i}</td>
                <td>${route[i].lat.toFixed(4)}</td>
                <td>${route[i].lng.toFixed(4)}</td>
            </tr>
        `;
    }

    // Last row adalah end point (PENS lagi)
    tbody.innerHTML += `
        <tr style="background: #e8f4f8; font-weight: bold;">
            <td>${route.length - 1}</td>
            <td>${route[route.length - 1].lat.toFixed(4)}</td>
            <td>${route[route.length - 1].lng.toFixed(4)}</td>
        </tr>
    `;
}

function clearMap() {
    layers.forEach(l => map.removeLayer(l));
    layers = [];

    numberMarkers.forEach(m => map.removeLayer(m));
    numberMarkers = [];
}

function sendData() {
    clearMap();
    document.getElementById("summary").innerHTML = "";

    if (points.length === 0) {
        alert("Tambahkan minimal 1 titik terlebih dahulu!");
        return;
    }

    fetch('/optimize', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            start: startPoint,
            points: points
        })
    })
    .then(res => res.json())
    .then(data => {
        routeData = data;
        
        // DRAW MERAH DULU (input_order, lebih lebar)
        // Kemudian BIRU (optimized, lebih tipis di atas)
        drawRoute(data.input_order, "red", "🔴 Urutan Input (Baseline)");
        
        // Delay untuk biru agar dibuat after merah
        setTimeout(() => {
            drawRoute(data.optimized, "blue", "🔵 Rute Optimal");
        }, 1000);
        
        updateOptimTable(data.optimized);
        
        // Add numbering setelah routes selesai di-draw
        setTimeout(() => {
            addNumberingBothRoutes(data.input_order, data.optimized);
        }, 3500);
    })
    .catch(err => console.error(err));
}

function drawRoute(route, color, label) {
    var apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjdhYzFmMzRmZTRmNDRhMTJhZGUwZDI4ZTEwOTNhMWVkIiwiaCI6Im11cm11cjY0In0=";
    var coords = route.map(p => [p.lng, p.lat]);

    fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coordinates: coords })
    })
    .then(res => res.json())
    .then(data => {
        // Style berbeda untuk merah dan biru
        var style = color === "red" ? 
            {
                color: color,
                weight: 8,           // MERAH: lebih lebar
                opacity: 0.8,
                dashArray: "none",
                lineCap: "round",
                lineJoin: "round",
                zIndex: 100          // Merah di belakang
            } : 
            {
                color: color,
                weight: 3,           // BIRU: lebih tipis
                opacity: 0.9,
                dashArray: "none",
                lineCap: "round",
                lineJoin: "round",
                zIndex: 200          // BIRU: di depan (di atas merah)
            };

        var geo = L.geoJSON(data, {
            style: style
        }).addTo(map);

        layers.push(geo);

        var jarak = data.features[0].properties.summary.distance / 1000;

        document.getElementById("summary").innerHTML += `
            <div style="margin: 5px 0; padding: 10px; background: ${color === 'red' ? 'rgba(231, 76, 60, 0.1)' : 'rgba(52, 152, 219, 0.1)'}; border-left: 4px solid ${color}; border-radius: 4px;">
                <strong>${label}</strong><br>
                Jarak: ${jarak.toFixed(2)} km
            </div>
        `;
    })
    .catch(err => console.error("Error drawing route:", err));
}

function addNumberingBothRoutes(inputOrderRoute, optimizedRoute) {
    // Numbering untuk input order route (merah) - kiri
    for (let i = 1; i < inputOrderRoute.length - 1; i++) {
        var icon = L.divIcon({
            html: `<div style="
                background: #e74c3c;
                color: white;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                text-align: center;
                line-height: 32px;
                font-weight: bold;
                font-size: 12px;
                box-shadow: 0 2px 8px rgba(231, 76, 60, 0.5);
                border: 2px solid white;
                position: relative;
                left: -15px;">
                ${i}
            </div>`,
            iconSize: [32, 32]
        });

        var marker = L.marker([inputOrderRoute[i].lat, inputOrderRoute[i].lng], { icon: icon }).addTo(map);
        numberMarkers.push(marker);
    }
    
    // Numbering untuk optimized route (biru) - kanan
    for (let i = 1; i < optimizedRoute.length - 1; i++) {
        var icon = L.divIcon({
            html: `<div style="
                background: #3498db;
                color: white;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                text-align: center;
                line-height: 32px;
                font-weight: bold;
                font-size: 12px;
                box-shadow: 0 2px 8px rgba(52, 152, 219, 0.5);
                border: 2px solid white;
                position: relative;
                right: -15px;">
                ${i}
            </div>`,
            iconSize: [32, 32]
        });

        var marker = L.marker([optimizedRoute[i].lat, optimizedRoute[i].lng], { icon: icon }).addTo(map);
        numberMarkers.push(marker);
    }
}

// ===== DASHBOARD FUNCTIONS =====

function loadDashboard() {
    const loadingEl = document.getElementById('dashboardLoading');
    const contentEl = document.getElementById('dashboardContent');
    const errorEl = document.getElementById('dashboardError');
    
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';

    fetch('/dashboard')
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            populateDashboard(data);
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        })
        .catch(err => {
            console.error(err);
            errorEl.textContent = 'Gagal memuat dashboard: ' + err.message;
            errorEl.style.display = 'block';
            loadingEl.style.display = 'none';
        });
}

function populateDashboard(data) {
    const distRoute = data.distance_route;
    const optRoute = data.optimized_route;
    const improvement = data.improvement;

    // Update metric cards
    document.getElementById('metricDistance').textContent = optRoute.metrics.distance.toFixed(0);
    document.getElementById('metricBBM').textContent = optRoute.metrics.bbm.toFixed(2);
    document.getElementById('metricMacet').textContent = optRoute.metrics.macet.toFixed(2);
    document.getElementById('metricImprovement').textContent = improvement.toFixed(1) + '%';

    // Update comparison table
    const tableBody = document.getElementById('comparisonTableBody');
    tableBody.innerHTML = `
        <tr>
            <td class="route-label">Rute Jarak Tersingkat</td>
            <td>${distRoute.metrics.distance.toFixed(2)}</td>
            <td>${distRoute.metrics.bbm.toFixed(2)}</td>
            <td>${distRoute.metrics.macet.toFixed(2)}</td>
            <td>${distRoute.metrics.risiko.toFixed(2)}</td>
        </tr>
        <tr>
            <td class="route-label">Rute Optimal</td>
            <td>${optRoute.metrics.distance.toFixed(2)}</td>
            <td>${optRoute.metrics.bbm.toFixed(2)}</td>
            <td>${optRoute.metrics.macet.toFixed(2)}</td>
            <td>${optRoute.metrics.risiko.toFixed(2)}</td>
        </tr>
    `;

    // Create charts
    createComparisonChart(distRoute.metrics, optRoute.metrics);
    createEfficiencyChart(distRoute.metrics, optRoute.metrics);
}

function createComparisonChart(distMetrics, optMetrics) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    if (comparisonChart) {
        comparisonChart.destroy();
    }

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jarak (km)', 'Konsumsi BBM', 'Kemacetan', 'Risiko Pengiriman'],
            datasets: [
                {
                    label: 'Urutan Input',
                    data: [
                        distMetrics.distance,
                        distMetrics.bbm,
                        distMetrics.macet,
                        distMetrics.risiko
                    ],
                    backgroundColor: '#d4d4d4',
                    borderColor: '#999',
                    borderWidth: 0
                },
                {
                    label: 'Rute Optimal',
                    data: [
                        optMetrics.distance,
                        optMetrics.bbm,
                        optMetrics.macet,
                        optMetrics.risiko
                    ],
                    backgroundColor: '#333',
                    borderColor: '#1a1a1a',
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: '#666',
                        padding: 15
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' },
                    ticks: { font: { size: 11 }, color: '#999' }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 }, color: '#666' }
                }
            }
        }
    });
}

function createEfficiencyChart(distMetrics, optMetrics) {
    const ctx = document.getElementById('efficiencyChart').getContext('2d');
    
    if (efficiencyChart) {
        efficiencyChart.destroy();
    }

    const improvement = (
        (distMetrics.distance - optMetrics.distance) / distMetrics.distance * 100
    );

    efficiencyChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Peningkatan Efisiensi', 'Jarak Baseline'],
            datasets: [{
                data: [improvement, 100 - improvement],
                backgroundColor: ['#333', '#d4d4d4'],
                borderColor: ['#1a1a1a', '#999'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: '#666',
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}
