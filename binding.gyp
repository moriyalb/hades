{
	"targets": [
		{
			"target_name": "HadesN",
			"defines": ["__STDC_LIMIT_MACROS", "LINUX"],
			"include_dirs": [
				"./src"
			],
			"cflags_cc": ["-frtti", "-fexceptions", "-fpermissive", "-std=c++11", "-Wno-reorder"],
			"cflags": ["-fexceptions", "-Wno-unused", "-Wno-sign-compare"],			
			"sources": [
				"./src/main.cc"	
			]
		}
	]
}
