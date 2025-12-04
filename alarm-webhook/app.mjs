import crypto from 'crypto';

const WEBHOOK_URL = process.env.DEVOPS_AGENT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.DEVOPS_AGENT_WEBHOOK_SECRET;

export const handler = async (event) => {
    // SNSメッセージからアラーム情報を抽出
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);

    // DevOps Agent用のペイロード作成
    const timestamp = new Date().toISOString();
    
    // リソース情報を抽出
    const trigger = snsMessage.Trigger || {};
    const dimensions = trigger.Dimensions || [];
    
    // Lambda関数名を取得
    let functionName = null;
    for (const dim of dimensions) {
        if (dim.name === 'FunctionName') {
            functionName = dim.value;
            break;
        }
    }
    
    // 影響を受けるリソースのARNを構築
    const affectedResources = [];
    if (functionName) {
        const functionArn = `arn:aws:lambda:${snsMessage.Region}:${snsMessage.AWSAccountId}:function:${functionName}`;
        affectedResources.push(functionArn);
    }
    
    // アラームARNも追加
    const alarmArn = `arn:aws:cloudwatch:${snsMessage.Region}:${snsMessage.AWSAccountId}:alarm:${snsMessage.AlarmName}`;
    
    const payload = {
        eventType: 'incident',
        incidentId: `alarm-${snsMessage.AlarmName}-${Math.floor(Date.now() / 1000)}`,
        action: 'created',
        priority: snsMessage.NewStateValue === 'ALARM' ? 'HIGH' : 'MEDIUM',
        title: snsMessage.AlarmName,
        description: `${snsMessage.AlarmDescription}\n\nAccount: ${snsMessage.AWSAccountId}\nRegion: ${snsMessage.Region}\nAlarm ARN: ${alarmArn}\n\nNew State: ${snsMessage.NewStateValue}\nReason: ${snsMessage.NewStateReason}`,
        service: trigger.Namespace || 'AWS',
        timestamp: timestamp,
        affectedResources: affectedResources,
        data: {
            metadata: {
                alarm_name: snsMessage.AlarmName,
                alarm_arn: alarmArn,
                region: snsMessage.Region,
                account_id: snsMessage.AWSAccountId,
                metric_name: trigger.MetricName || '',
                namespace: trigger.Namespace || '',
                function_name: functionName
            }
        }
    };

    const payloadJson = JSON.stringify(payload);

    // HMAC署名を生成 (timestamp:payload形式)
    const signatureInput = `${timestamp}:${payloadJson}`;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(signatureInput, 'utf8');
    const signature = hmac.digest('base64');

    // Webhookリクエスト送信
    const headers = {
        'Content-Type': 'application/json',
        'x-amzn-event-signature': signature,
        'x-amzn-event-timestamp': timestamp
    };

    // リクエスト情報をログ出力
    console.log('=== REQUEST ===');
    console.log(`URL: ${WEBHOOK_URL}`);
    console.log(`Headers: ${JSON.stringify(headers, null, 2)}`);
    console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
    console.log(`Signature Input: ${signatureInput.substring(0, 100)}...`);
    console.log(`Signature: ${signature}`);

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: headers,
            body: payloadJson
        });

        const responseBody = await response.text();
        const responseHeaders = Object.fromEntries(response.headers.entries());

        // レスポンス情報をログ出力
        console.log('=== RESPONSE ===');
        console.log(`Status: ${response.status}`);
        console.log(`Headers: ${JSON.stringify(responseHeaders, null, 2)}`);
        console.log(`Body: ${responseBody}`);

        return {
            statusCode: response.status,
            body: JSON.stringify('Investigation triggered successfully')
        };
    } catch (error) {
        // エラー情報をログ出力
        console.log('=== ERROR ===');
        console.log(`Error: ${error.message}`);
        console.log(`Stack: ${error.stack}`);
        throw error;
    }
};
