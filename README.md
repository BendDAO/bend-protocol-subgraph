# Subgraph for Bend Protocol

## Development

```bash
# copy env and adjust its content
# you can get an access token from https://thegraph.com/explorer/dashboard
cp .env.test .env

# install project dependencies
npm i

# fetch current contracts as submodule
npm run prepare:subgraph

# run build
npm run subgraph:build

# now you're able to deploy to thegraph via
npm run deploy:hosted:mainnet

```

## Deployment

To be able to deploy the subgraph in any environment for any network first we will need to prepare the local env.

### Self-hosted

- The first time you will deploy the subgraph you need to first create it in the TheGraph node:

```shell
# For Rinkeby:
npm run subgraph:create:self-hosted:rinkeby

# for Mainnet
npm run subgraph:create:self-hosted:mainnet
```

- Before any deployment you need to generate the types and schemas:

```shell
npm run subgraph:codegen
```

- When / If the subgraph is created you can then deploy

```shell
# For Rinkeby:
npm run deploy:self-hosted:rinkeby

# For Mainnet:
npm run deploy:self-hosted:mainnet
```

### Hosted

To be able to deploy to the hosted solution you will need to create a .env file and add `ACCESS_TOKEN` environment variable. You can find this in the dashboard of the TheGraph

```shell
# For Rinkeby:
npm run deploy:hosted:rinkeby

# For Mainnet:
npm run deploy:hosted:mainnet
```

### Local
1. Start environment for a hardhat node
If you want to use mainnet or testnet, or already started hardhat node, jump to next step.

```shell
################################################################################
# clone bend protocol repo
git clone https://github.com/bendfinance/bend-protocol

cd bend-protocol

# install project dependencies
npm i --force

################################################################################
# In first terminal, start localhost node
npm run hardhat:node

# In second terminal, deploy all contracts and trigger some events
npm run test:subgraph:localhost

################################################################################
# For advanced testing
# In second terminal, deploy all contracts
npm run bend:localhost:dev:migration

# Now you can connect wallet or frontend to localhost node at http://127.0.0.1:8545/
# Starting hardhat console, interact with Bend in localhost via console
# How to use console, please read README.md in bend-protocol, and hardhat documents
npx hardhat --network localhost console

# Now you shoud check contracts addresses in deployments/deployed-contracts-localhost.json
```

2. Start docker environment for TheGraph infrastructure:

Remember that before runing `docker-compose up` you need to run `docker-compose down` if it is not the first time.
That is because the postgres database and ipfs data needs to not be persistant, so we need to delete the docker volumes.

```shell
docker-compose down

docker container prune -f

docker volume prune -f

# or using ls and rm
# docker volume ls
# docker volume rm bend-protocol-subgraph_xxx

```

```shell
# development using localhost hardhat node
docker-compose up

# or development using develop, api url can be infura or alchemy
#export GRAPH_ETHEREUM="develop:https://rinkeby.infura.io/v3/${INFURA_KEY}"
export GRAPH_ETHEREUM="develop:https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_KEY}"

docker-compose up

# or development using rinkeby, api url can be infura or alchemy
#export GRAPH_ETHEREUM="rinkeby:https://rinkeby.infura.io/v3/${INFURA_KEY}"
export GRAPH_ETHEREUM="rinkeby:https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_KEY}"

docker-compose up

# or development using mainnet, api url can be infura or alchemy
#export GRAPH_ETHEREUM="mainnet:https://mainnet.infura.io/v3/${INFURA_KEY}"
export GRAPH_ETHEREUM="mainnet:https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}"

docker-compose up

```

3. Deploy local subgraph:

```shell
# create subgraph
npm run subgraph:create:local

# development using localhost config
# Before deploying, you should fill correct contracts addresses in ./config/dev.conf.
# You can find addresses in bend-protocol/deployments/deployed-contracts-localhost.json.
npm run deploy:local:localhost

# or development using develop config
# Before deploying, you should fill correct contracts addresses in ./config/develop.conf.
npm run deploy:local:develop

# or development using rinkeby config
# Before deploying, you should fill correct contracts addresses in ./config/rinkeby.conf.
npm run deploy:local:rinkeby

# or development using mainnet config
# Before deploying, you should fill correct contracts addresses in ./config/mainnet.conf.
npm run deploy:local:mainnet

```

4. To check or query the subgraph use:

```
Subgraph endpoints:
Queries (HTTP):     http://localhost:8000/subgraphs/name/bend/bend-protocol
Subscriptions (WS): http://localhost:8001/subgraphs/name/bend/bend-protocol

INFO Starting JSON-RPC admin server at: http://localhost:8020, component: JsonRpcServer
INFO Starting GraphQL HTTP server at: http://localhost:8000, component: GraphQLServer
INFO Starting index node server at: http://localhost:8030, component: IndexNodeServer
INFO Starting GraphQL WebSocket server at: ws://localhost:8001, component: SubscriptionServer
INFO Starting metrics server at: http://localhost:8040, component: MetricsServer

```
