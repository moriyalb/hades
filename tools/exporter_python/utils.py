import os

def make_sure_path(path):
	if not os.path.exists(path):
		os.makedirs(path)

def getObjSortedKeys(obj):
	#by key name
	return sorted(list(obj.keys()))

AUTO_CODE = {
	"tag":"%s====",
	"start" : "%s====%s start",
	"end" : "%s====%s end",
	"pstart" : "%s====private code start",
	"pend" : "%s====private code end",
	"pbstart" : "%s====public code start",
	"pbend" : "%s====public code end",
	"rstart" : "%s====require start",
	"rend" : "%s====require end",
	"gstart" : "%s====global start",
	"gend" : "%s====global end",
	"prostart" : "%s====property start",
	"proend" : "%s====property end",
	"oldstart" : "%s====old start",
	"oldend" : "%s====old end",
}

def exportWarn(f, comment):
	f.write('''%s\n'''%(comment * 50))
	f.write('''%s Warning! This file is auto-generated! Don't modify it or your code will be lost! \n'''%(comment))
	f.write('''%s\n\n'''%(comment * 50))

def exportWarn2(f, comment):
	f.write('''%s\n'''%(comment * 50))
	f.write('''%s Warning! This file is auto-generated! Pay attention write code follow the rules below: \n'''%(comment))
	index = 1
	f.write('''%s    %d-> write your requirements between %s====require start/end==== comments\n'''%(comment, index, comment))
	index = index + 1
	f.write('''%s    %d-> write your global defines between %s====global start/end==== comments\n'''%(comment, index, comment))
	index = index + 1
	f.write('''%s    %d-> write your entity method codes between %s====[methodName] start/end==== comments\n'''%(comment, index, comment))
	index = index + 1
	f.write('''%s    %d-> write your public or private codes between %s====private code start/end==== comments\n'''%(comment, index, comment))
	f.write('''%s Any other codes will be removed when export the entities definition!!\n'''%(comment))
	f.write('''%s\n\n'''%(comment * 50))

def exportWarn3(f, comment):
	f.write('''%s\n'''%(comment * 50))
	f.write('''%s Warning! This file is auto-generated! Pay attention write code follow the rules below: \n'''%(comment))
	index = 1
	f.write('''%s    %d-> write your implements between %s====codes start/end==== comments\n'''%(comment, index, comment))
	index = index + 1
	f.write('''%s    %d-> write your method codes between %s====[methodName] start/end==== comments\n'''%(comment, index, comment))
	f.write('''%s Any other codes will be removed when export the entities definition!!\n'''%(comment))
	f.write('''%s\n\n'''%(comment * 50))

def importUserCode(f, comment):
	user = {"__private":[],"__public":[], "__require":[], "__global":[], "__property":[], "____old":[]}
	tag = AUTO_CODE['tag']%(comment)
	pstart = AUTO_CODE['pstart']%(comment)
	pend = AUTO_CODE['pend']%(comment)
	pbstart = AUTO_CODE['pbstart']%(comment)
	pbend = AUTO_CODE['pbend']%(comment)
	rstart = AUTO_CODE['rstart']%(comment)
	rend = AUTO_CODE['rend']%(comment)
	gstart = AUTO_CODE['gstart']%(comment)
	gend = AUTO_CODE['gend']%(comment)
	prostart = AUTO_CODE['prostart']%(comment)
	proend = AUTO_CODE['proend']%(comment)
	oldstart = AUTO_CODE['oldstart']%(comment)
	oldend = AUTO_CODE['oldend']%(comment)
	startMethod = False
	startPrivate = False
	startPublic = False
	startRequire = False
	startGlobal = False
	startProperty = False
	startOldMethod = False
	methodName = ""
	for _line in f.readlines():
		line = _line.strip()
		if line.startswith(oldstart):
			startOldMethod = True
		elif line.startswith(oldend):
			startOldMethod = False
		elif line.startswith(pstart):
			startPrivate = True
		elif line.startswith(pend):
			startPrivate = False
		elif line.startswith(pbstart):
			startPublic = True
		elif line.startswith(pbend):
			startPublic = False
		elif line.startswith(rstart):
			startRequire = True
		elif line.startswith(rend):
			startRequire = False
		elif line.startswith(gstart):
			startGlobal = True
		elif line.startswith(gend):
			startGlobal = False
		elif line.startswith(prostart):
			startProperty = True
		elif line.startswith(proend):
			startProperty = False
		elif line.startswith(tag):
			if 'start' not in line and 'end' not in line:
				continue
			methodName, start = line[len(tag):].replace("=","").split(" ")
			startMethod = start == "start"
			if not methodName in user:
				user[methodName] = {
					"used":False,
					"codes":[]
				}
		elif startMethod:
			user[methodName]["codes"].append(_line)
		elif startOldMethod:
			user["____old"].append(_line)
		elif startPrivate:
			user['__private'].append(_line)
		elif startPublic:
			user['__public'].append(_line)
		elif startRequire:
			user['__require'].append(_line)
		elif startGlobal:
			user['__global'].append(_line)
		elif startProperty:
			user['__property'].append(_line)
	return user
