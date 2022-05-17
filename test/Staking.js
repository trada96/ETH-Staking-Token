const Stake = artifacts.require("SNDStaking");
const BEP20 = artifacts.require("BEP20");
const web3 = require("web3");
const truffleAssert = require('truffle-assertions');


contract("Staking Test Cases", async ([account_owner, account_one, account_two, account_three]) => {

    const TOKEN = process.env.TOKEN;
    const MIN_AMOUNT = process.env.MIN_AMOUNT;
    const PROFIT = process.env.PROFIT;
    const MIN_DURATION = process.env.MIN_DURATION;


    const stakeAmount_1 = 500;
    const stakeAmount_1_1 = 1500;
    const stakeAmount_2 = 800;
    const stakeAmount_3 = 1000;

    const newMinAmount = 300;
    const newStakeDuration = 5; // seconds
    const newProfitPercent = 20;

    const timeSleep = 10;

    before(async () => {
        contract = await Stake.new(TOKEN, MIN_AMOUNT, PROFIT, MIN_DURATION);
        token = await BEP20.at(TOKEN);
        await token.transfer(account_one, 6000);
        await token.transfer(account_two, 4000);
        await token.transfer(account_three, 5000);
    });

    async function get_balanceOf(account) {
        const balance = await token.balanceOf(account);
        return balance.toNumber();
    }


    before(async () => {
        balanceOfOwnerBefore = await get_balanceOf(account_owner);
        balanceOfOneBefore = await get_balanceOf(account_one);
        balanceOftwoBefore = await get_balanceOf(account_two);
        balanceOfthreeBefore = await get_balanceOf(account_three);

        balanceOfContractBefore = await contract.balanceOfContract();

    });


    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function caluclateReward(amount, profit) {
        return amount * (100 + profit) / 100
    }

    // =============================
    it("Check init parameters", async () => {
        let tokenAddress = await contract.token();
        let minAmount = await contract.getMinAmount();
        let profitPercent = await contract.getProfitPercent();
        let stakeDuration = await contract.getStakeDuration();

        assert.equal(tokenAddress, TOKEN);
        assert.equal(minAmount, minAmount);
        assert.equal(profitPercent, PROFIT);
        assert.equal(stakeDuration, MIN_DURATION);

    });

    // ==============================
    it("Set new parameter by owner", async () => {

        await contract.setMinAmount(newMinAmount, { from: account_owner });
        await contract.setStakeDuration(newStakeDuration, { from: account_owner });
        await contract.setProfitPercent(newProfitPercent, { from: account_owner });

        let minAmount = await contract.getMinAmount();
        let profitPercent = await contract.getProfitPercent();
        let stakeDuration = await contract.getStakeDuration();

        assert.equal(minAmount.toNumber(), newMinAmount);
        assert.equal(profitPercent.toNumber(), newProfitPercent);
        assert.equal(stakeDuration.toNumber(), newStakeDuration);
    });

    // ===============================
    it("Stake token", async () => {


        await token.approve(contract.address, stakeAmount_1, { from: account_one });
        await contract.stake(stakeAmount_1, { from: account_one });

        await token.approve(contract.address, stakeAmount_2, { from: account_two });
        await contract.stake(stakeAmount_2, { from: account_two });

        await token.approve(contract.address, stakeAmount_3, { from: account_three });
        await contract.stake(stakeAmount_3, { from: account_three });

        await token.approve(contract.address, stakeAmount_1_1, { from: account_one });
        await contract.stake(stakeAmount_1_1, { from: account_one });

        const holders = await contract.getAllHolder();
        const addresses = [account_one, account_two, account_three]

        assert.equal(holders.toString(), addresses.toString());

        const holder_1 = await contract.getStakeByID(1);
        const holder_2 = await contract.getStakeByID(2);
        const holder_3 = await contract.getStakeByID(3);
        const holder_4 = await contract.getStakeByID(4);

        assert.equal(holder_1.holder, account_one);
        assert.equal(holder_2.holder, account_two);
        assert.equal(holder_3.holder, account_three);
        assert.equal(holder_4.holder, account_one);

        const stakeIds_1 = await contract.getStakeByUser(account_one);
        const stakeIds_2 = await contract.getStakeByUser(account_two);
        const stakeIds_3 = await contract.getStakeByUser(account_three);

        const _ids_1 = [1, 4];
        const _ids_2 = [2];
        const _ids_3 = [3];

        assert.equal(stakeIds_1.toString(), _ids_1.toString());
        assert.equal(stakeIds_2.toString(), _ids_2.toString());
        assert.equal(stakeIds_3.toString(), _ids_3.toString());

    });

    it("Stake with special cases ", async () => {

        // stake amount < minAmount
        const stakeAmount = 20;
        await token.approve(contract.address, stakeAmount, { from: account_three });
        await truffleAssert.reverts(contract.stake(stakeAmount, { from: account_three }), "Amount Staking is not Enough");

        // staking when pause

        await contract.pause({ from: account_owner });
        await token.approve(contract.address, stakeAmount, { from: account_three });
        await truffleAssert.reverts(contract.stake(stakeAmount, { from: account_three }), "Paused!");

        await contract.unpause({ from: account_owner });
    });


    //===================================================
    it("Cancel Staking ", async () => {

        const stakeAmount = 1111;

        await token.approve(contract.address, stakeAmount, { from: account_three });
        await contract.stake(stakeAmount, { from: account_three });

        await contract.cancelStake(5, { from: account_three });

        const stakeInfo = await contract.getStakeByID(5);

        assert.equal(stakeInfo.closed, true);

    });

    // ===================================================
    it("Claim reward when not enough duration", async () => {
        const rewardAble = await contract.claimRewardable(2, { from: account_two });
        assert.equal(rewardAble, false);

        await truffleAssert.reverts(contract.claimReward(2, { from: account_two }), "Too Early!");

    });


    // ===================================================
    it("Claim reward when wrong holder", async () => {

        await sleep(timeSleep * 1000);

        const rewardAble = await contract.claimRewardable(2);
        assert.equal(rewardAble, true);

        await truffleAssert.reverts(contract.claimReward(2, { from: account_one }), "Wrong holder!");

    });

    it("Claim reward", async () => {


        const rewardAble = await contract.claimRewardable(2);
        assert.equal(rewardAble, true);

        const balanceOfAccountBefore = await get_balanceOf(account_two);
        await contract.claimReward(2, { from: account_two });

        const balanceOfAccountAfter = await get_balanceOf(account_two);
        const _profit = await caluclateReward(stakeAmount_2, newProfitPercent);

        // console.log("BE", balanceOfAccountBefore);
        // console.log("AFter", balanceOfAccountAfter);
        // console.log("profit ", balanceOfAccountAfter - balanceOfAccountBefore);
        // console.log("profit2 ", _profit);

        assert.equal(balanceOfAccountAfter, balanceOfAccountBefore + _profit);
    });

    // ===================================================
    it("Claim reward when wrong holder", async () => {

        console.log("BALANCE OF OWNER Before", balanceOfOwnerBefore);
        console.log("BALANCE OF ACC 1 Before", balanceOfOneBefore);
        console.log("BALANCE OF ACC 2 Before", balanceOftwoBefore);
        console.log("BALANCE OF ACC 3 Before", balanceOfthreeBefore);

        console.log("BALANCE OF Contract Before", balanceOfContractBefore.toNumber());

        balanceOfOwnerAfter = get_balanceOf(account_owner);
        balanceOfOneAfter = get_balanceOf(account_one);
        balanceOftwoAfter = get_balanceOf(account_two);
        balanceOfthreeAfter = get_balanceOf(account_three);

        balanceOfContractAfter = await contract.balanceOfContract();

        console.log("BALANCE OF OWNER After", balanceOfOwnerAfter);
        console.log("BALANCE OF ACC 1 After", balanceOfOneAfter);
        console.log("BALANCE OF ACC 2 After", balanceOftwoAfter);
        console.log("BALANCE OF ACC 3 After", balanceOfthreeAfter);

        console.log("BALANCE OF Contract After", balanceOfContractAfter.toNumber());


    });

});

