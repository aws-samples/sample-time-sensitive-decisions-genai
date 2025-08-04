import boto3
import json
import os
import logging
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr

# Set up logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('DYNAMODB_TABLE'))

# Helper class to convert Decimal to float for JSON serialization
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    
    try:
        # Get query parameters
        query_params = event.get('queryStringParameters', {}) or {}
        print(query_params)
        
        # Pagination parameters
        page_size = int(query_params.get('limit', '10'))
        start_key = query_params.get('nextToken')
        if start_key:
            start_key = json.loads(start_key)
        
        # Filter parameters
        job_id = query_params.get('job_id')
        result = query_params.get('result')
        object_name = query_params.get('object')
        
        # Build query parameters
        query_params = {}
        
        # If job_id is provided, use it as the primary key
        if job_id:
            query_params['KeyConditionExpression'] = Key('job_id').eq(job_id)
            query_params['ScanIndexForward'] = False
        # If result is provided, use the GSI
        elif result:
            query_params['IndexName'] = 'ResultIndex'
            query_params['KeyConditionExpression'] = Key('result').eq(result)
            query_params['ScanIndexForward'] = False
        elif object_name:
            query_params['IndexName'] = 'ObjectIndex'
            query_params['KeyConditionExpression'] = Key('Object').eq(object_name)
            query_params['ScanIndexForward'] = False
        
        # Add filter for object if provided
        # if object_name:
        #     if 'FilterExpression' not in query_params:
        #         query_params['FilterExpression'] = Attr('Object').contains(object_name)
        #     else:
        #         query_params['FilterExpression'] = query_params['FilterExpression'] & Attr('Object').contains(object_name)
        
        # Add pagination parameters
        query_params['Limit'] = page_size
        if start_key:
            query_params['ExclusiveStartKey'] = start_key
        
        # If no specific query is provided, use scan instead
        if not job_id and not result and not object_name:
            if object_name:
                print(f"object_name: {object_name}")
                response = table.scan(
                    FilterExpression=Attr('Object').contains(object_name),
                    Limit=page_size,
                    # ExclusiveStartKey=start_key if start_key else None
                )
                print(response)
            else:
                response = table.scan(
                    Limit=page_size,
                    # ExclusiveStartKey=start_key if start_key else None
                )
                if 'Items' in response:
                    response['Items'].sort(key=lambda x: x.get('date', ''), reverse=True)
        else:
            # Execute query
            print(f"query params: {query_params}")
            response = table.query(**query_params)
        
        # Prepare response
        result = {
            'items': response.get('Items', []),
            'count': response.get('Count', 0),
            'scannedCount': response.get('ScannedCount', 0)
        }
        
        # Add pagination token if available
        if 'LastEvaluatedKey' in response:
            result['nextToken'] = json.dumps(response['LastEvaluatedKey'])
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps(result, cls=DecimalEncoder)
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