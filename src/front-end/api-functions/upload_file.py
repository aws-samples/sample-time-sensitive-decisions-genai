import boto3
import json
import os
import logging
import base64
import uuid
from urllib.parse import unquote_plus

# Set up logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize S3 client
s3 = boto3.client('s3')
UPLOAD_BUCKET = os.environ.get('UPLOAD_BUCKET')

def lambda_handler(event, context):
    logger.info(f"Event received")
    print(event)
    
    # Check HTTP method
    http_method = event.get('httpMethod')
    
    # Handle GET requests for presigned URLs
    if http_method == 'GET':
        return generate_presigned_url(event, context)
    
    # Handle OPTIONS requests for CORS
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps({})
        }
    try:
        # Parse request body
        if 'body' not in event:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'message': 'Missing request body'})
            }
        
        # Check if the body is base64 encoded
        is_base64_encoded = event.get('isBase64Encoded', False)
        
        if is_base64_encoded:
            body = base64.b64decode(event['body'])
            content_type = event.get('headers', {}).get('content-type', '')
            
            # For multipart form data, we need to parse the form data
            if 'multipart/form-data' in content_type:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'message': 'Please use the presigned URL approach for file uploads'})
                }
            else:
                # For direct binary uploads
                file_content = body
                file_name = event.get('queryStringParameters', {}).get('filename', f"upload-{uuid.uuid4()}")
        else:
            # For JSON payload with base64 encoded file
            try:
                body = json.loads(event['body'])
                if 'file' not in body or 'filename' not in body:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        'body': json.dumps({'message': 'Missing file or filename in request'})
                    }
                
                file_content = base64.b64decode(body['file'])
                file_name = body['filename']
            except json.JSONDecodeError:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'message': 'Invalid JSON in request body'})
                }
        
        # Generate a unique file key
        file_key = f"{file_name}"
        
        # Upload to S3
        s3.put_object(
            Bucket=UPLOAD_BUCKET,
            Key=file_key,
            Body=file_content
        )
        
        # Return success response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps({
                'message': 'File uploaded successfully',
                'fileKey': file_key
            })
        }
    
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Internal server error',
                'error': str(e)
            })
        }

def generate_presigned_url(event, context):
    """Generate a presigned URL for uploading a file to S3"""
    try:
        # Parse request
        query_params = event.get('queryStringParameters', {}) or {}
        file_name = query_params.get('filename')
        content_type = query_params.get('contentType')
        
        if not file_name:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
                    'Access-Control-Max-Age': '3600'
                },
                'body': json.dumps({'message': 'Missing filename parameter'})
            }
        
        # Generate a unique file key
        file_key = f"{file_name}"
        
        # Generate presigned URL
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': UPLOAD_BUCKET,
                'Key': file_key,
                'ContentType': content_type
            },
            ExpiresIn=3600  # URL expires in 1 hour
        )
        
        # Return the presigned URL
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
                'Access-Control-Max-Age': '3600'
            },
            'body': json.dumps({
                'presignedUrl': presigned_url,
                'fileKey': file_key
            })
        }
    
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
                'Access-Control-Max-Age': '3600'
            },
            'body': json.dumps({
                'message': 'Internal server error',
                'error': str(e)
            })
        }