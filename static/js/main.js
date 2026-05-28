var startPoint = [-7.275788, 112.793982];

var map = L.map('map').setView(startPoint, 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OSM'
}).addTo(map);

L.marker(startPoint).addTo(map).bindPopup("Kampus PENS");

var points = [];
var layers = [];
var numberMarkers = [];

// ===== TAMBAH TITIK =====
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

    L.marker([lat, lng]).addTo(map);

    updateTable();

    document.getElementById("lat").value = "";
    document.getElementById("lng").value = "";
    document.getElementById("bbm").value = "";
    document.getElementById("macet").value = "";
    document.getElementById("risiko").value = "";
}

// ===== TABEL INPUT =====
function updateTable() {
    var tbody = document.getElementById("tbody");
    tbody.innerHTML = "";

    for (let i = 0; i < points.length; i++) {
        tbody.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td>${points[i].lat}</td>
                <td>${points[i].lng}</td>
                <td>${points[i].bbm}</td>
                <td>${points[i].macet}</td>
                <td>${points[i].risiko}</td>
            </tr>
        `;
    }
}

// ===== TABEL OPTIMASI =====
function updateOptimTable(route) {
    var tbody = document.getElementById("optTable");
    tbody.innerHTML = "";

    for (let i = 1; i < route.length - 1; i++) {
        tbody.innerHTML += `
            <tr>
                <td>${i}</td>
                <td>${route[i].lat}</td>
                <td>${route[i].lng}</td>
            </tr>
        `;
    }
}

// ===== CLEAR MAP =====
function clearMap() {
    layers.forEach(l => map.removeLayer(l));
    layers = [];

    numberMarkers.forEach(m => map.removeLayer(m));
    numberMarkers = [];
}

// ===== PROSES =====
function sendData() {

    clearMap();
    document.getElementById("summary").innerHTML = "";

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

        drawRoute(data.baseline, "red");
        drawRoute(data.optimized, "blue");

        updateOptimTable(data.optimized);
        addNumbering(data.optimized);

    })
    .catch(err => console.error(err));
}

// ===== ROUTE ORS =====
function drawRoute(route, color) {

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

        var geo = L.geoJSON(data, {
            style: {
                color: color,
                weight: color === "red" ? 8 : 4
            }
        }).addTo(map);

        layers.push(geo);

        var jarak = data.features[0].properties.summary.distance / 1000;

        document.getElementById("summary").innerHTML += `
            ${color === "red" ? "Baseline" : "Optimasi"}: ${jarak.toFixed(2)} km<br>
        `;
    });
}

// ===== NUMBERING =====
function addNumbering(route) {

    for (let i = 1; i < route.length - 1; i++) {

        var icon = L.divIcon({
            html: `<div style="
                background: blue;
                color: white;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                text-align: center;
                line-height: 28px;
                font-weight: bold;">
                ${i}
            </div>`
        });

        var marker = L.marker(route[i], { icon: icon }).addTo(map);
        numberMarkers.push(marker);
    }
}