# Legal Demand General Application

A simple web application for managing legal demand documents. This application allows users to view records from DynamoDB and upload files to S3.

## Architecture

- **Frontend**: Simple HTML, CSS, and JavaScript single page application
- **Backend**: AWS Lambda functions (Python 3.12) with API Gateway
- **Storage**: DynamoDB for document metadata, S3 for document storage
- **Deployment**: AWS SAM (Serverless Application Model)
- **CDN**: CloudFront for content delivery

## Prerequisites

- AWS CLI installed and configured
- AWS SAM CLI installed
- Python 3.12

## Project Structure

```
legal-demand-general/
├── src/
│   ├── front-end/           # Frontend code
│   │   ├── css/             # CSS styles
│   │   ├── js/              # JavaScript code
│   │   ├── index.html       # Main HTML page
│   │   └── error.html       # Error page
│   └── back-end/            # Backend code
│       ├── api-functions/   # Lambda functions for API
│       ├── bedrock-processor/  # Existing Lambda function
│       └── textract-processor/ # Existing Lambda function
├── template.yaml            # SAM template
└── README.md                # This file
```

## Deployment Instructions

1. **Build the SAM application**:

```bash
sam build
```

2. **Deploy the application**:

```bash
sam deploy --guided
```

Follow the prompts to configure your deployment.

3. **Update the frontend configuration**:

After deployment, update the `apiBaseUrl` in `src/front-end/js/app.js` with the API Gateway URL from the deployment outputs.

4. **Upload the frontend files to S3**:

```bash
aws s3 sync src/front-end/ s3://YOUR_FRONTEND_BUCKET_NAME/
```

Replace `YOUR_FRONTEND_BUCKET_NAME` with the actual bucket name from the deployment outputs.

## Features

- View records from DynamoDB with pagination (10 records per page)
- Filter records by job_id, result, or object name
- Upload files to S3
- Responsive design

## API Endpoints

- `GET /api/records` - Get records from DynamoDB with optional filtering
- `POST /api/upload` - Upload a file to S3

## Security Considerations

- CORS is enabled on the API Gateway to allow requests from the frontend
- CloudFront is used to serve the frontend securely
- S3 bucket policies restrict access to the frontend and upload buckets