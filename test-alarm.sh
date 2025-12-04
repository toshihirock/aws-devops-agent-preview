#!/bin/bash

# SNSトピックARNを取得
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name sam-app \
  --query 'Stacks[0].Outputs[?OutputKey==`AlarmTopic`].OutputValue' \
  --output text \
  --region us-east-1)

echo "SNS Topic ARN: $TOPIC_ARN"

# テスト用のCloudWatch Alarmメッセージを作成
MESSAGE=$(cat <<EOF
{
  "AlarmName": "sam-app-HelloWorldFunction-Errors",
  "AlarmDescription": "Alert when Lambda function returns errors",
  "AWSAccountId": "$(aws sts get-caller-identity --query Account --output text)",
  "NewStateValue": "ALARM",
  "NewStateReason": "Threshold Crossed: 1 datapoint [1.0 (23/11/24 12:00:00)] was greater than or equal to the threshold (1.0).",
  "StateChangeTime": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "Region": "us-east-1",
  "Trigger": {
    "MetricName": "Errors",
    "Namespace": "AWS/Lambda",
    "StatisticType": "Statistic",
    "Statistic": "SUM",
    "Unit": null,
    "Dimensions": [
      {
        "name": "FunctionName",
        "value": "sam-app-HelloWorldFunction"
      }
    ],
    "Period": 60,
    "EvaluationPeriods": 1,
    "ComparisonOperator": "GreaterThanOrEqualToThreshold",
    "Threshold": 1.0
  }
}
EOF
)

# SNSトピックにメッセージを送信
aws sns publish \
  --topic-arn "$TOPIC_ARN" \
  --message "$MESSAGE" \
  --region us-east-1

echo "Test alarm message published to SNS topic"
