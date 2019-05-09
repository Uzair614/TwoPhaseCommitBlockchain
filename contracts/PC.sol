pragma solidity >=0.4.25 <0.6.0;

contract PC {
  address public owner;
  enum state {INIT, VOTING, COMMIT, ABORT}
  state curState;
  address[] workers;
  address[] voted;
  uint256 timeOutDelay;
  uint256 mintTime;

  modifier restricted() {
    if (msg.sender == owner) _;
  }

  constructor() public {
    owner = msg.sender;
    timeOutDelay = 0;
    curState = state.INIT;
  }

  function request(address[] memory processes, uint _timeOut) public restricted {
    require(curState == state.INIT, "Contract not in init state");
    workers = processes;
    voted.length = 0;
    timeOutDelay = _timeOut;
    curState = state.VOTING;
    mintTime = now;
  }

  function voter(bool vote) public {
    require(curState == state.VOTING, "Contract not in voting state");
    require(isWorker(msg.sender), "Sender not a worker process");
    require(!hasVoted(msg.sender), "Sender has already voted");
    voted.push(msg.sender);
    if(!vote) {
      curState = state.ABORT;
      return;
    }
    if(voted.length == workers.length) {
      curState = state.COMMIT;
    }
  }

  function verdict() public{
    require(curState == state.VOTING, "Contract not in voting state");
    require(isWorker(msg.sender), "Sender not a worker process");
    require(hasTimedOut(), "Current iteration has not timed out");
    curState = state.ABORT;
  }

  function getVal() public view returns (uint256) {
    return mintTime;
  }

  function hasTimedOut() public view returns (bool) {
    return now > mintTime + timeOutDelay;
    // return false;
  }

  function hasVoted(address p) private view returns ( bool ) {
    for (uint8 index = 0; index < voted.length; index++) {
      if(p == voted[index]) {
        return true;
      }
    }
    return false;
  }

  function getCurrentState() public view returns (state) {
    return curState;
  }

  function isWorker(address p) private view returns ( bool ) {
    for (uint8 index = 0; index < workers.length; index++) {
      if(p == workers[index]) {
        return true;
      }
    }
    return false;
  }
}
