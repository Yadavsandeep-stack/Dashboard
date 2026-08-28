# Faculty Research Dashboard

A Flask-based dashboard for exploring faculty research data at Dr. B. R. Ambedkar National Institute of Technology Jalandhar (NIT Jalandhar).

## Features

- Overview cards for total faculty, publications, citations, patents, and projects
- Interactive year-wise research trends
- Department distribution chart
- Faculty list with filtering and pagination
- Top researchers analytics by publications, citations, patents, or projects
- Search and filter by department, research area, and year
- CSV download for the faculty dataset
- News & updates section for announcements

## Tech Stack

- **Backend:** Python, Flask, pandas
- **Frontend:** HTML, CSS, JavaScript
- **Charts/UI:** Chart.js, Bootstrap 5
- **Deployment:** Gunicorn-compatible

## Project Structure

- `app.py` — Flask application and API routes
- `templates/` — HTML templates
- `static/` — CSS, JavaScript, images, and data files
- `static/data/faculty.csv` — main dataset used by the dashboard

## Requirements

Install dependencies with:

```bash
pip install -r requirements.txt
```

## Run Locally

1. Make sure the faculty dataset exists at `static/data/faculty.csv`.
2. Start the app:

```bash
python app.py
```

3. Open the app in your browser:

```text
http://127.0.0.1:5000
```

## API Endpoints

- `GET /api/faculty` — paginated faculty records with optional filters
- `GET /api/charts` — chart data grouped by year and department
- `GET /api/analytics` — top faculty by selected metric
- `GET /api/news` — latest announcements
- `GET /download` — download the CSV file

## Query Parameters

The API supports filters such as:

- `department`
- `research_area`
- `year`
- `search`
- `page`
- `per_page`
- `metric` for analytics
- `top_n` for analytics

## Notes

- If the CSV file is missing, the app will return an error message.
- The dashboard is designed to be simple to deploy on platforms that support Flask apps.

## License

No license has been specified yet.