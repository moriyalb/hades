const TIMEOUT_MAX = 2147483647 // 2^31-1

class BigTimer
{
	constructor(handler, after){
		this.handler = handler
		this.after = after
		this.tid = 0
		this.start()
	}

	start(){
		if (this.after <= TIMEOUT_MAX){
			this.tid = setTimeout(this.handler, this.after)
		}else{
			this.tid = setTimeout(()=>{
				this.after -= TIMEOUT_MAX
				this.start()
			}, TIMEOUT_MAX)
		}
	}

	cancel(){
		clearTimeout(this.tid)
	}
}

function setTimeoutEx(handler, after) {
	return new BigTimer(handler, after)
}

function clearTimeoutEx(timer){
	timer.cancel()
}

module.exports = {
	setTimeoutEx, clearTimeoutEx
}