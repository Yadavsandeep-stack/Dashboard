let yearChartInstance = null;
let deptChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    // Sidebar toggle
    document.getElementById("sidebarToggle").addEventListener("click", () => {
        document.getElementById("sidebar-wrapper").classList.toggle("collapsed");
    });

    // Navigation
    document.querySelectorAll("#sidebar-wrapper a").forEach(link => {
        link.addEventListener("click", e => {
            if (link.getAttribute("href").startsWith("http") || link.getAttribute("href") === "/download") return;
            e.preventDefault();
            document.querySelectorAll("#sidebar-wrapper a").forEach(a => a.classList.remove("active"));
            link.classList.add("active");

            document.querySelectorAll("[id^='section-']").forEach(s => s.classList.add("d-none"));
            const target = link.id.replace("nav-", "section-");
            document.getElementById(target)?.classList.remove("d-none");

            if (target === "section-faculty") loadFaculty(1);
            if (target === "section-analytics") loadTopResearchers();
            if (target === "section-overview") renderCharts();
        });
    });

    // Filters trigger refresh
    ["filterDept", "filterResearch", "filterYear", "globalSearch"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", debounce(() => {
            loadFaculty(1);
            renderCharts();
            if (document.getElementById("section-analytics").classList.contains("d-none") === false) {
                loadTopResearchers();
            }
        }, 500));
    });

    document.getElementById("analyticsMetric")?.addEventListener("change", loadTopResearchers);
    document.getElementById("resetFilters")?.addEventListener("click", () => {
        ["filterDept","filterResearch","filterYear","globalSearch"].forEach(id => {
            document.getElementById(id).value = "";
        });
        loadFaculty(1);
        renderCharts();
        loadTopResearchers();
    });

    // Initial load
    renderCharts();
    populateFilters();
    document.getElementById("nav-overview").click(); // trigger overview
});

// Debounce for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load Faculty Table with Pagination
async function loadFaculty(page = 1) {
    page = Math.max(1, parseInt(page) || 1);  // ← NEVER allow 0 or negative

    const params = new URLSearchParams({
        page: page,
        per_page: 15,
        department: document.getElementById("filterDept").value || "",
        research_area: document.getElementById("filterResearch").value || "",
        year: document.getElementById("filterYear").value || "",
        search: document.getElementById("globalSearch").value || ""
    });

    const res = await fetch(`/api/faculty?${params}`);
    const data = await res.json();

    // === Render Table ===
    const tbody = document.getElementById("facultyTableBody");
    if (data.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No faculty found</td></tr>`;
    } else {
        tbody.innerHTML = data.items.map((f, i) => `
            <tr>
                <td>${(page - 1) * 15 + i + 1}</td>
                <td>${f.faculty_name || 'N/A'}</td>
                <td>${f.department || 'N/A'}</td>
                <td>${f.research_area || 'N/A'}</td>
                <td>${f.publications || 0}</td>
                <td>${f.citations || 0}</td>
                <td>${f.patents || 0}</td>
                <td>${f.projects || 0}</td>
                <td>${f.year || 'N/A'}</td>
            </tr>
        `).join("");
    }

    // === Smart Pagination (Max 10 buttons, centered on current page) ===
    const pagination = document.getElementById("facultyPagination");
    pagination.innerHTML = "";

    if (data.pages <= 1) return;  // no need for pagination

    const maxButtons = 10;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = Math.min(data.pages, startPage + maxButtons - 1);

    // Adjust start if we're near the end
    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // First & Prev
    if (page > 1) {
        pagination.appendChild(createPageBtn("First", 1));
        pagination.appendChild(createPageBtn("Prev", page - 1));
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(createPageBtn(i, i, i === page));
    }

    // Next & Last
    if (page < data.pages) {
        pagination.appendChild(createPageBtn("Next", page + 1));
        pagination.appendChild(createPageBtn("Last", data.pages));
    }

    function createPageBtn(text, targetPage, isActive = false) {
        const btn = document.createElement("button");
        btn.className = `btn btn-sm mx-1 ${isActive ? "btn-primary" : "btn-outline-primary"}`;
        btn.textContent = text;
        btn.disabled = isActive;
        btn.onclick = () => loadFaculty(targetPage);
        return btn;
    }
}
// Charts
async function renderCharts() {
    const params = new URLSearchParams({
        department: document.getElementById("filterDept").value || "",
        research_area: document.getElementById("filterResearch").value || "",
        year: document.getElementById("filterYear").value || "",
        search: document.getElementById("globalSearch").value || ""
    });

    const res = await fetch(`/api/charts?${params}`);
    const json = await res.json();

    // === YEAR CHART (Publications + Citations) ===
    const yearData = json.year_chart || {};
    const years = Object.keys(yearData).map(Number).sort((a, b) => a - b);

    if (years.length === 0) years.push(new Date().getFullYear());

    const pubs = years.map(y => yearData[y]?.publications || 0);
    const cites = years.map(y => yearData[y]?.citations || 0);

    const ctx1 = document.getElementById("yearChart").getContext("2d");
    if (yearChartInstance) yearChartInstance.destroy();

    yearChartInstance = new Chart(ctx1, {
        type: "line",
        data: {
            labels: years.length ? years : ["No data"],
            datasets: [
                {
                    label: "Publications",
                    data: pubs,
                    borderColor: "#0d6efd",
                    backgroundColor: "rgba(13, 110, 253, 0.1)",
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5
                },
                {
                    label: "Citations",
                    data: cites,
                    borderColor: "#e74c3c",
                    backgroundColor: "rgba(231, 76, 60, 0.1)",
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    yAxisID: "yCitations"  // separate scale for citations
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Publications", color: "#0d6efd" }
                },
                yCitations: {
                    position: "right",
                    beginAtZero: true,
                    title: { display: true, text: "Citations", color: "#e74c3c" },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                title: { display: true, text: "Research Output Over Years" },
                legend: { position: "top" }
            }
        }
    });

    // === DEPARTMENT DOUGHNUT (unchanged) ===
    const deptData = json.dept_chart || {};
    const labels = Object.keys(deptData);
    const values = Object.values(deptData);

    const ctx2 = document.getElementById("deptChart").getContext("2d");
    if (deptChartInstance) deptChartInstance.destroy();

    deptChartInstance = new Chart(ctx2, {
        type: "doughnut",
        data: {
            labels: labels.length ? labels : ["No data"],
            datasets: [{
                data: values.length ? values : [1],
                backgroundColor: ["#0d6efd","#20c997","#fd7e14","#6f42c1","#d63384","#198754","#ffc107","#dc3545"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } }
        }
    });

}

    const deptData = json.dept_chart || {};
    const ctx2 = document.getElementById("deptChart").getContext("2d");
    if (deptChartInstance) deptChartInstance.destroy();
    deptChartInstance = new Chart(ctx2, {
        type: "doughnut",
        data: {
            labels: Object.keys(deptData),
            datasets: [{
                data: Object.values(deptData),
                backgroundColor: ["#0d6efd","#20c997","#fd7e14","#6f42c1","#d63384","#198754","#ffc107","#dc3545"]
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });


// Top Researchers
async function loadTopResearchers() {
    const metric = document.getElementById("analyticsMetric").value;
    const params = new URLSearchParams({
        metric,
        department: document.getElementById("filterDept").value,
        research_area: document.getElementById("filterResearch").value,
        year: document.getElementById("filterYear").value,
        search: document.getElementById("globalSearch").value,
        top_n: 10
    });

    const res = await fetch(`/api/analytics?${params}`);
    const data = await res.json();

    const tbody = document.getElementById("analyticsTableBody");
    tbody.innerHTML = data.length ? data.map((r, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${r.faculty_name}</td>
            <td>${r.department}</td>
            <td>${r.research_area}</td>
            <td>${r.publications}</td>
            <td>${r.citations}</td>
            <td>${r.patents}</td>
            <td>${r.projects}</td>
            <td>${r.year}</td>
        </tr>
    `).join("") : `<tr><td colspan="9" class="text-center text-muted">No data</td></tr>`;
}

// Populate Filters from API
async function populateFilters() {
    const res = await fetch("/api/faculty?per_page=1000");
    const data = await res.json();
    const items = data.items;

    const depts = [...new Set(items.map(x => x.department))].sort();
    const areas = [...new Set(items.map(x => x.research_area))].sort();
    const years = [...new Set(items.map(x => x.year))].sort();

    const deptSel = document.getElementById("filterDept");
    depts.forEach(d => deptSel.appendChild(new Option(d, d)));

    const areaSel = document.getElementById("filterResearch");
    areas.forEach(a => areaSel.appendChild(new Option(a, a)));

    const yearSel = document.getElementById("filterYear");
    years.forEach(y => yearSel.appendChild(new Option(y, y)));
}

// === Hide/Show Sidebar ===
// === Hide/Show Sidebar with Icon Toggle ===
// ——————————————————————
// HIDE / SHOW SIDEBAR BUTTON (WITH ICON CHANGE)
// ——————————————————————
document.getElementById("hideSidebarBtn")?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar-wrapper");
    const content = document.getElementById("page-content-wrapper");
    const btn = document.getElementById("hideSidebarBtn");
    const menuBtn = document.getElementById("sidebarToggle");

    sidebar.classList.toggle("d-none");
    content.classList.toggle("w-100");

    if (sidebar.classList.contains("d-none")) {
        // Hidden → show "open" icon
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13z"/>
                <path d="M3 5.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
            </svg>`;
        btn.title = "Show sidebar";
        menuBtn.style.display = "block";
    } else {
        // Visible → show "hide" icon
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0v15a.5.5 0 0 1-1 0V15h-8v.5a.5.5 0 0 1-1 0v-15a.5.5 0 0 1 .5-.5z"/>
                <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 3h-13z"/>
            </svg>`;
        btn.title = "Hide sidebar";
        menuBtn.style.display = "none";
    }
});

// ——————————————————————
// NEWS TAB — CLICK TO LOAD
// ——————————————————————
document.getElementById("nav-news")?.addEventListener("click", function(e) {
    e.preventDefault();
    document.querySelectorAll("#sidebar-wrapper a").forEach(a => a.classList.remove("active"));
    this.classList.add("active");
    document.querySelectorAll("[id^='section-']").forEach(s => s.classList.add("d-none"));
    document.getElementById("section-news").classList.remove("d-none");
    loadNews();  // This will now actually run
});
// === Load News ===
async function loadNews() {
    const container = document.getElementById("newsContainer");
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border"></div></div>`;

    try {
        const res = await fetch("/api/news");
        const news = await res.json();
        container.innerHTML = news.map(n => `
            <div class="border-start border-primary border-4 ps-4 py-3 mb-3">
                <h6 class="text-primary">${n.title}</h6>
                <small class="text-muted">${n.date}</small>
                <p class="mt-1">${n.desc}</p>
                <span class="badge bg-success">${n.type}</span>
            </div>
        `).join("") || "<p class='text-muted text-center'>No news right now.</p>";
    } catch {
        container.innerHTML = "<p class='text-danger text-center'>Failed to load news.</p>";
    }
}

// Auto-load news when tab is clicked
document.getElementById("nav-news")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll("#sidebar-wrapper a").forEach(a => a.classList.remove("active"));
    e.target.classList.add("active");
    document.querySelectorAll("[id^='section-']").forEach(s => s.classList.add("d-none"));
    document.getElementById("section-news").classList.remove("d-none");
    loadNews();
});

// === NEWS TAB CLICK HANDLER (THIS WAS MISSING!) ===
document.getElementById("nav-news")?.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Activate tab
    document.querySelectorAll("#sidebar-wrapper a").forEach(a => a.classList.remove("active"));
    e.target.classList.add("active");

    // Show section
    document.querySelectorAll("[id^='section-']").forEach(s => s.classList.add("d-none"));
    document.getElementById("section-news").classList.remove("d-none");

    // Load news
    loadNews();
});