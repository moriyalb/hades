"use strict"

const Hades = GlobalHades

class HadesHotfix{
	constructor(){

	}

	/**
	 * make all the hotfix module reloading.
	 */
	hotfix(){
		//console.log("==== Hotfixed! ====")
		
		//configs
		Hades.Config.resetConfig(Hades.Config.projectRoot())

		//schema scripts
		Hades.Schema.resetMetaMethod()

		//hook event
		Hades.Event.emit(Hades.Event.HOOK_ON_HOTFIX)
	}	
}

module.exports = new HadesHotfix()