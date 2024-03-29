# Subgraph for Bend Protocol

## Development

```bash
# copy env and adjust its content
# you can get an access token from https://thegraph.com/explorer/dashboard
cp .env.test .env

# install project dependencies
yarn // or npm i

# fetch current contracts as submodule
npm run prepare:subgraph

# run build
npm run subgraph:build

# now you're able to deploy to thegraph via
npm run deploy:hosted:mainnet

```

## Deployment

To be able to deploy the subgraph in any environment for any network first we will need to prepare the local env.

### Hosted

To be able to deploy to the hosted solution you will need to create a .env file and add `ACCESS_TOKEN` environment variable. You can find this in the dashboard of the TheGraph

```shell
# For Sepolia:
npm run deploy:hosted:sepolia

# For Mainnet:
npm run deploy:hosted:mainnet
```

### Local
1. Start environment for a hardhat node
If you want to use mainnet or testnet, or already started hardhat node, jump to next step.

```shell
################################################################################
# clone bend protocol repo
git clone https://github.com/benddao/bend-lending-protocol

cd bend-lending-protocol

# install project dependencies
yarn # or npm i --force

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
docker-compose down; docker container prune -f; docker volume prune -f; docker network prune -f;

# or using ls and rm
# docker volume ls
# docker volume rm bend-protocol-subgraph_xxx

```

```shell
# development using localhost hardhat node
docker-compose up

# or development using sepolia, api url can be infura or alchemy
#export GRAPH_ETHEREUM="sepolia:https://sepolia.infura.io/v3/${INFURA_KEY}"
export GRAPH_ETHEREUM="sepolia:https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}"

docker-compose up

# or development using mainnet, api url can be infura or alchemy
#export GRAPH_ETHEREUM="mainnet:https://mainnet.infura.io/v3/${INFURA_KEY}"
export GRAPH_ETHEREUM="mainnet:https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}"

docker-compose up

```

3. Deploy local subgraph:

```shell
# create subgraph
npm run subgraph:create:local

# development using localhost config
# Before deploying, you should fill correct contracts addresses in ./config/localhost.conf.
# You can find addresses in bend-protocol/deployments/deployed-contracts-localhost.json.
npm run deploy:local:localhost

# or development using sepolia config
# Before deploying, you should fill correct contracts addresses in ./config/sepolia.conf.
npm run deploy:local:sepolia

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
