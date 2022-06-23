# break-glass-access

This project contains four Lambda functions and a Step Function that orchestrate
break glass access. It's triggered through a Slack interactivity request. For
example, we can send a Slack message like this:

```
https://slack.com/api/chat.postMessage
```

```json
{
  "icon_emoji": "sparkles",
  "username": "Live Laugh Ship",
  "channel": "12345",
  "as_user": true,
  "attachments": [
    {
      "type": "mrkdwn",
      "text": "Deployment *ABC* is being rolled back.",
      "fallback": "Deployment ABC is being rolled back.",
      "callback_id": "deployment_123456789012_abc",
      "color": "#fc6f03",
      "attachment_type": "default",
      "actions": [
        {
          "name": "retry",
          "text": "Retry",
          "type": "button",
          "value": "retry"
        },
        {
          "name": "break_glass",
          "text": "Break Glass Prod",
          "style": "danger",
          "type": "button",
          "value": "arn:aws:sso:::permissionSet/ssoins-12345/ps-12345",
          "confirm": {
            "title": "Are you sure?",
            "text": "Are you sure?",
            "ok_text": "Yes",
            "dismiss_text": "No"
          }
        }
      ]
    }
  ]
}
```

When the API Gateway deployed in `infrastructure` is hit by Slack (configured
with the interactivity settings in the Slack app developer portal), it triggers
the Step Function which grants access, revokes it, and then e-mails a report.

![An example e-mail report in which the user's email is shown, along with 
the date and time of their access. Two tables are below that information, 
one showing the user's access in the AWS SSO portal, one showing their 
actions once logged into an account.](./images/access-report.png)

## Lambda functions

* access-requested

    Answers the Slack interactivity webhook. Starts the Step Function.

* grant-access

    Assigns an AWS SSO permission set to the user.

* revoke-access

    Removes the AWS SSO permission set.

* report-on-access

    Sends an e-mail detailing what was accessed by querying CloudTrail.

    **NB:** this part of the process is a best-effort attempt at searching for
    the right information. If problematic access is reported, verify that it was
    the user you think it was. Double check access yourself to make sure nothing
    was missed.

## Data storage and configuration

A DynamoDB table is used for two use cases: converting Slack user IDs into
SSO principals, and configuring which users can access which permission sets.

Here's an example record for linking a Slack user to an SSO principal ID:

```json
{
  "id": {
    "S": "principal#<slack ID>"
  },
  "ssoPrincipal": {
    "S": "<SSO user UUID>"
  }
}
```

Here's an example record for allowing a user to access a permission set:

```json
{
  "id": {
    "S": "access#<account ID>#<permission set name>#<permission set ARN>"
  }
}
```

## Building the Lambda function container image

1. Setup your AWS CLI profile.

2. Authenticate with ECR:

    ```
    aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <AWS ACCOUNT ID>.dkr.ecr.<REGION>.amazonaws.com
    ```

3. Build the image:

    ```
    docker build -t <AWS ACCOUNT ID>.dkr.ecr.<REGION>.amazonaws.com/break-glass-access:1.0.0 .
    ```

4. Push it:

    ```
    docker push <AWS ACCOUNT ID>.dkr.ecr.<REGION>.amazonaws.com/break-glass-access:1.0.1
    ```

## Deploying this yourself

This project is released as Open Source to demonstrate the technique and to
allow you to use it in the creation of your own tooling for break glass
production access. It's not designed to be a turnkey solution you can drop in.
