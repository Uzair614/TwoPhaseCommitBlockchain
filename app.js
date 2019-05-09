const Web3 = require('web3');
const solc = require('solc')
const fs = require('fs');
const web3 = new Web3('ws://localhost:7545');
// const web3 = new Web3('ws://localhost:8545');

(main = async () => {
    const accounts = await web3.eth.getAccounts();
    // const latestBlock = await web3.eth.getBlock("latest");
    // console.log(latestBlock.timestamp)
    const pc = new PhaseCommit(accounts);
    pc.deploy()
    const mc = new MetaCoin(accounts);
    mc.deploy()
})();

class MetaCoin {
    constructor(accounts) {
        this.traders = accounts.slice(5, 10);
        this.creator = accounts[5];
        this.metaContract = readAbi('MetaCoin')
    }

    deploy() {
        const cb = this.makeTransactions.bind(this)
        deployContract(this.metaContract, this.metaContract.data, this.creator,
            cb)
    }

    makeTransactions(contractAddress, timestamp) {
        setTimeout(async () => {
            const latestBlock = await web3.eth.getBlock("latest");
            // console.log('latest time: ', latestBlock.timestamp)
            if (!this.metaContract.address) {
                this.metaContract.address = contractAddress;
            }
            const sender = this.traders[(Math.floor(Math.random() * 10) % 5)]
            const receiver = this.traders[((sender + 1) % 5)]
            this.metaContract.methods.sendCoin(receiver, 10).send({
                from: sender,
                gas: '4700000',
                gasPrice: '100000000000'
            });
            this.makeTransactions(contractAddress, timestamp)
        }, 1000)
    }
}

class PhaseCommit {
    constructor(accounts) {
        this.pcContract = compileContract('PC');
        this.coordinator = accounts[0];
        this.workerAccounts = accounts.slice(1, 5);
    }
    deploy() {
        const cb = this.pcProtocol.bind(this)
        deployContract(this.pcContract, this.pcContract.data, this.coordinator,
            cb)
    }

    workingInit() {
        this.pcContract.methods.request(this.workerAccounts, 3).send({
            from: this.coordinator,
            gas: '4700000',
            gasPrice: '100000000000'
        });
    }

    async pcProtocol(contractAddress, timestamp) {
        this.pcContract.address = contractAddress;

        // 0 - success, 1 - init fail, 2 - process timeout
        const workTime = this.getConfig(0);
        const timeout = timestamp + 10;
        checkContractState = checkContractState.bind(this)
        const valid = await checkContractState(1, timeout)
        if (valid) {
            this.contractInitiated(timeout, workTime);
        } else {
            console.log('Coordinator Crashed. Protocol Aborted')
        }

    }

    // 0 - success, 1 - init fail, 2 - process timeout
    getConfig(status) {
        if (status != 1) {
            this.workingInit();
        }
        if (status == 2) {
            return Math.random() * 2000;
        }
        return Math.random() * 2;
    }

    async contractInitiated(timeout, workTime) {
        this.workerAccounts.forEach(addr => {
            setTimeout(() => {
                this.pcContract.methods.voter(true).send({
                    from: addr,
                    gas: '4700000',
                    gasPrice: '100000000000'
                });
            }, workTime * 1000);
        });

        const valid = await checkContractState(2, timeout)
        if (valid) {
            console.log('2PC Committed')
        } else {
            console.log('Processes timed out. 2PC aborted')
            this.workerAccounts.forEach(async addr => {
                this.pcContract.methods.verdict().send({
                    from: addr,
                    gas: '4700000',
                    gasPrice: '100000000000'
                }).catch(v => console.log("Contract aborted"))
            })

        }
    }
}

async function checkContractState(targetState, maxTime) {
    const latestBlock = await web3.eth.getBlock("latest");
    if (latestBlock.timestamp > maxTime) {
        return false;
    } else {
        const state = await this.pcContract.methods.getCurrentState.call();
        // console.log('state in check: ', state)
        if (state == targetState) {
            return true;
        }
        return checkContractState(targetState, maxTime)
    }
}

function compileContract(name) {
    nameWithExt = name + '.sol';
    var code = fs.readFileSync('./contracts/' + nameWithExt, 'utf8').toString();
    const input = {
        language: 'Solidity',
        sources: {
            [nameWithExt]: {
                content: code
            }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            }
        }
    }
    const compiledCode = JSON.parse(solc.compile(JSON.stringify(input)))
    const abiDefinition = compiledCode.contracts[nameWithExt][name].abi
    const bytecode = compiledCode.contracts[nameWithExt][name].evm.bytecode.object
    return new web3.eth.Contract(abiDefinition, null, { data: bytecode });
}

function deployContract(contract, bytecode, senderAccount, cb) {
    contract.deploy({
        data: bytecode
    }).send({
        from: senderAccount,
        gas: '4700000',
        gasPrice: '100000000000'
    })
        .on('error', (error) => { console.log('error', error) })
        .on('transactionHash', async (transactionHash) => {
            const receipt = await web3.eth.getTransactionReceipt(transactionHash)
            const blkInfo = await web3.eth.getBlock(receipt.blockNumber);
            cb(receipt.contractAddress, blkInfo.timestamp)
        })
        .catch(console.log)
}


function readAbi(name) {
    nameWithExt = name + '.json';
    const compiledCode = JSON.parse(fs.readFileSync('./build/' + nameWithExt, 'utf8'));
    return new web3.eth.Contract(compiledCode.abi, null, { data: compiledCode.bytecode });
}