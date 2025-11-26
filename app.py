from flask import Flask, render_template, jsonify, request, send_from_directory, abort
import pandas as pd
import math
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

CSV_DIR = "static/data"
CSV_FILE = os.path.join(CSV_DIR, "faculty.csv")

def load_data():
    if not os.path.exists(CSV_FILE):
        raise FileNotFoundError(f"CSV not found at {CSV_FILE}")
    
    df = pd.read_csv(CSV_FILE)
    
    # Ensure expected columns exist
    expected = ["faculty_name","department","research_area","publications","citations","patents","projects","type","year"]
    for c in expected:
        if c not in df.columns:
            df[c] = "" if c in ["faculty_name","department","research_area","type"] else 0

    # Normalize numeric columns safely
    for col in ["publications","citations","patents","projects","year"]:
        df[col] = pd.to_numeric(df[col].astype(str).str.strip(), errors="coerce").fillna(0).astype(int)

    # Fill string columns
    df["faculty_name"] = df["faculty_name"].fillna("Unknown")
    df["department"] = df["department"].fillna("Unknown")
    df["research_area"] = df["research_area"].fillna("Other")
    df["type"] = df["type"].fillna("Unknown")

    return df


@app.route("/")
def index():
    try:
        df = load_data()
    except Exception as e:
        return f"<h1>Error loading CSV: {e}</h1>", 500

    # Stats
    stats = {
    "total_faculty": int(len(df)),   # FIXED HERE
    "total_publications": int(df["publications"].sum()),
    "total_citations": int(df["citations"].sum()),
    "total_patents": int(df["patents"].sum()),
    "total_projects": int(df["projects"].sum())
}


    # Chart data — group by year sorted ascending
    chart_df = (
        df.groupby("year")
        .agg({"publications":"sum","citations":"sum","patents":"sum","projects":"sum"})
        .reset_index()
        .sort_values("year")
    )
    chart_data = chart_df.to_dict(orient="records")

    # For filters
    departments = sorted(df["department"].unique().tolist())
    research_areas = sorted(df["research_area"].unique().tolist())
    years = sorted(df["year"].unique().tolist())

    return render_template(
        "index.html",
        stats=stats,
        chart_data=chart_data,
        departments=departments,
        research_areas=research_areas,
        years=years
    )

@app.route("/api/faculty")
def api_faculty():
    """
    Query params:
      - page (default 1)
      - per_page (default 10)
      - department
      - research_area
      - year
      - search
    """
    try:
        df = load_data()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    page = max(1, int(request.args.get("page", 1)))
    per_page = max(1, min(200, int(request.args.get("per_page", 10))))
    department = request.args.get("department", "").strip()
    research_area = request.args.get("research_area", "").strip()
    year = request.args.get("year", "").strip()
    search = request.args.get("search", "").strip().lower()

    q = df.copy()
    if department:
        q = q[q["department"] == department]
    if research_area:
        q = q[q["research_area"] == research_area]
    if year:
        try:
            y = int(year)
            q = q[q["year"] == y]
        except:
            pass
    if search:
        q = q[q["faculty_name"].str.lower().str.contains(search) | q["research_area"].str.lower().str.contains(search)]

    total = len(q)
    pages = math.ceil(total / per_page) if per_page else 1
    start = (page - 1) * per_page
    end = start + per_page
    items = q.iloc[start:end].to_dict(orient="records")

    # Ensure plain python types
    for item in items:
        for k, v in item.items():
            if pd.isna(v):
                item[k] = ""
            elif hasattr(v, "item"):
                try:
                    item[k] = v.item()
                except:
                    pass

    return jsonify({
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": pages,
        "items": items
    })

@app.route("/api/charts")
def api_charts():
    try:
        df = load_data()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Filters
    department = request.args.get("department", "").strip()
    research_area = request.args.get("research_area", "").strip()
    year = request.args.get("year", "").strip()
    search = request.args.get("search", "").strip().lower()

    q = df.copy()
    if department:
        q = q[q["department"] == department]
    if research_area:
        q = q[q["research_area"] == research_area]
    if year:
        try:
            q = q[q["year"] == int(year)]
        except:
            pass
    if search:
        mask = q["faculty_name"].str.lower().str.contains(search, na=False) | \
               q["research_area"].str.lower().str.contains(search, na=False)
        q = q[mask]

    # Group by year and sum metrics
    yearly = q.groupby("year").agg({
        "publications": "sum",
        "citations": "sum",
        "patents": "sum",
        "projects": "sum"
    })

    # Remove years with zero activity (optional but clean)
    yearly = yearly[(yearly["publications"] > 0) | (yearly["citations"] > 0)]

    year_chart = yearly.to_dict(orient="index")  # {2020: {publications: 120, citations: 850}, ...}

    dept_counts = q["department"].value_counts().to_dict()

    return jsonify({
        "dept_chart": dept_counts,
        "year_chart": year_chart  # now contains all metrics
    })
@app.route("/api/analytics")
def api_analytics():
    try:
        df = load_data()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Accept metric + filters
    metric = request.args.get("metric", "publications").strip()
    top_n = min(10, int(request.args.get("top_n", 10)))

    # Filters
    department = request.args.get("department", "").strip()
    research_area = request.args.get("research_area", "").strip()
    year = request.args.get("year", "").strip()
    search = request.args.get("search", "").strip().lower()

    # Validate metric
    allowed_metrics = ["publications", "citations", "patents", "projects"]
    if metric not in allowed_metrics:
        metric = "publications"

    q = df.copy()

    # Apply filters same as faculty API
    if department:
        q = q[q["department"] == department]
    if research_area:
        q = q[q["research_area"] == research_area]
    if year:
        try:
            y = int(year)
            q = q[q["year"] == y]
        except:
            pass
    if search:
        q = q[
            q["faculty_name"].str.lower().str.contains(search) |
            q["research_area"].str.lower().str.contains(search)
        ]

    # Sort by chosen metric (largest first)
    q = q.sort_values(metric, ascending=False).head(top_n)

    items = q[
        ["faculty_name","department","research_area","publications","citations","patents","projects","year"]
    ].to_dict(orient="records")

    return jsonify(items)

@app.route("/download")
def download_csv():
    if not os.path.exists(CSV_FILE):
        return abort(404)
    return send_from_directory(CSV_DIR, "faculty.csv", as_attachment=True)



@app.route("/api/news")
def api_news():
    # You can replace this with real RSS, database, or file later
    news_items = [
        {
            "title": "Dr. Rajesh Kumar awarded Best Researcher 2025",
            "date": "15 Nov 2025",
            "desc": "Recognized for outstanding contribution in Machine Learning and AI.",
            "type": "award"
        },
        {
            "title": "New Research Grant of ₹2.5 Cr sanctioned",
            "date": "10 Nov 2025",
            "desc": "Department of Computer Science received funding from DST for Quantum Computing project.",
            "type": "grant"
        },
        {
            "title": "100+ Papers accepted in SCI Journals this year",
            "date": "05 Nov 2025",
            "desc": "NIT Jalandhar achieves record publications in 2025.",
            "type": "achievement"
        },
        {
            "title": "International Conference on Sustainable Tech 2026",
            "date": "01 Nov 2025",
            "desc": "Call for papers open. Submit by 28 Feb 2026.",
            "type": "event"
        }
    ]
    return jsonify(news_items)
if __name__ == "__main__":
    app.run(debug=True, port=5000)
