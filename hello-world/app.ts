import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const tableName = process.env.TABLE_NAME || 'HelloWorldTable';
        const timestamp = new Date().toISOString();

        // DynamoDBにデータを保存
        await docClient.send(
            new PutCommand({
                TableName: tableName,
                Item: {
                    id: `request-${Date.now()}`,
                    message: 'hello world1',
                    timestamp: timestamp,
                    path: event.path,
                },
            }),
        );

        // 最新のアイテムを取得
        const result = await docClient.send(
            new GetCommand({
                TableName: tableName,
                Key: {
                    id: `request-${Date.now()}`,
                },
            }),
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'hello world',
                timestamp: timestamp,
                saved: true,
            }),
        };
    } catch (err) {
        console.log(err);
        throw err;
    }
};
