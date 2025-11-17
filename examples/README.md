# Creating Lambda Functions with New Relic Serverless-plugin

This is a guide to creating lambdas instrumented with New Relic using Serverless-plugin

## Supported Runtimes

| Runtime     | Versions               |
|-------------|------------------------|
| Python      | `python3.8`, `python3.9`, `python3.10`, `python3.11`, `python3.12`, `python3.13` |
| Node.js     | `nodejs16.x`, `nodejs18.x`, `nodejs20.x`, `nodejs22.x` |
| .NET   | `dotnet3.1`, `dotnet6`, `dotnet8`              |
| Java        | `java8.al2`, `java11`, `java17`, `java21`      |
| Provided    | `provided.al2`, `provided.al2023`         |
| Ruby        | `ruby3.2`, `ruby3.3`, `ruby3.4`          |

##  Quick Start

### Prerequisites

Before you begin, ensure you have:

1. **Node.js** >= 16.x installed
2. **Serverless Framework** v3.x or v4.x
   ```bash
   npm install -g serverless
   ```
3. **AWS CLI** configured with valid credentials
   ```bash
   aws configure
   ```
4. **New Relic Account** ([Sign up](https://newrelic.com/signup))
   - [Account ID](https://docs.newrelic.com/docs/accounts/install-new-relic/account-setup/account-id)
   - [Personal API Key](https://docs.newrelic.com/docs/apis/get-started/intro-apis/types-new-relic-api-keys#personal-api-key)

### Environment Setup

Set your New Relic credentials as environment variables:

```bash
export NEW_RELIC_ACCOUNT_ID=your-account-id-here
export NEW_RELIC_PERSONAL_API_KEY=your-api-key-here
```

### Deploy an Example

```bash
# Choose your runtime example
cd nodejs   # or python, ruby, java, dotnet, etc.

# Install dependencies
npm install

# Deploy to AWS
sls deploy
```

That's it! Your Lambda function is now instrumented with New Relic monitoring. 

##  Creating Your Own Lambda Function

### Step 1: Create Project Structure

```bash
mkdir my-lambda-function
cd my-lambda-function
```

### Step 2: Create Handler File

Choose your runtime and create a handler:

#### Node.js (`handler.js`)
```javascript
module.exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event));
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Hello from Lambda!' })
    };
};
```

#### Python (`handler.py`)
```python
import json

def handler(event, context):
    print(f'Event: {json.dumps(event)}')
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Hello from Lambda!'})
    }
```

#### Ruby (`app.rb`)
```ruby
require 'json'

def lambda_handler(event:, context:)
  puts "Event: #{event.to_json}"
  
  {
    statusCode: 200,
    body: {
      message: "Hello from Lambda!"
    }.to_json
  }
end
```

### Step 3: Create `serverless.yml`

```yaml
service: my-lambda-function

provider:
  name: aws
  runtime: nodejs20.x  # or python3.12, ruby3.3, java21, dotnet8, etc.
  region: us-east-1
  stage: prod

plugins:
  - serverless-newrelic-lambda-layers

custom:
  newRelic:
    accountId: ${env:NEW_RELIC_ACCOUNT_ID}
    apiKey: ${env:NEW_RELIC_PERSONAL_API_KEY}
    logLevel: info

functions:
  myFunction:
    handler: handler.handler  # format: filename.function_name
    events:
      - http:
          path: hello
          method: get
```

### Step 4: Create `package.json`

```json
{
  "name": "my-lambda-function",
  "version": "1.0.0",
  "scripts": {
    "deploy": "sls deploy",
    "remove": "sls remove",
    "logs": "sls logs -f myFunction -t"
  },
  "devDependencies": {
    "serverless": "^4.12.0"
  },
  "dependencies": {
    "serverless-newrelic-lambda-layers": "^5.12.0"
  }
}
```

### Step 5: Install & Deploy

```bash
npm install
sls deploy
```

### Step 7: View in New Relic

1. Go to [New Relic One](https://one.newrelic.com)
2. Navigate to **Lambda Functions** in the left menu
3. Find your function and view metrics, traces, and logs

## Runtime-Specific Guides

### Java

**Example:** [`java/`](./java)

**Prerequisites:**
- Java JDK 11+ 
- Maven 3.6+

**Structure:**
```
java/
├── pom.xml
├── serverless.yml
└── src/main/java/
    └── Handler.java
```

**Build & Deploy:**
```bash
mvn clean package
sls deploy
```

**Supported Runtimes:** `java8.al2`, `java11`, `java17`, `java21`

### .NET

**Example:** [`dotnet/`](./dotnet)

**Prerequisites:**
- .NET SDK 6.0+

**Build & Deploy:**
```bash
chmod +x build.sh
./build.sh
sls deploy
```

**Supported Runtimes:** `dotnet6`, `dotnet8`

See [`dotnet/readme.md`](./dotnet/readme.md) for detailed instructions.


