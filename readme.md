# setup requirements:

## Run a redis for queues

```bash
docker run --name redis -p 6379:6379 -d redis:7
```

## Create a directory called "stats" one level above this folder.

Here all temporary files will be saved, then processed then deleted

```bash
mkdir "../stats/"
```

# Test and verificate

```bash
SCAN_ID=$(curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/BobTheShoplifter/Spring4Shell-POC"}' | jq -r '.scanId') && curl -s "http://localhost:3000/api/scan/$SCAN_ID" | jq
```

# Test and verificate(other sets of commands)
 
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/user/repo.git"}'
```


```bash
curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/user/repo"}' | jq -r '.scanId'
```

```bash
# Replace YOUR_SCAN_ID with the UUID from step 1
curl -s http://localhost:3000/api/scan/YOUR_SCAN_ID | jq
```

```bash
SCAN_ID=$(curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/user/repo"}' | jq -r '.scanId') && \
curl -s "http://localhost:3000/api/scan/$SCAN_ID" | jq
```

```bash
# 1) Create scan and copy the scanId from the response
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/user/repo"}'

# 2) Check status (use the scanId from above)
curl http://localhost:3000/api/scan/<paste-scanId-here>
```

```bash
# 1) Create scan and copy the scanId from the response
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/user/repo"}'

# 2) Check status (use the scanId from above)
curl http://localhost:3000/api/scan/<paste-scanId-here>
```
