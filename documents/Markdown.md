# header1
## header2
### header3
#### header4 <!-- omit in toc -->
##### header5
###### header6

# 这是普通标题

<!-- 注释 -->



脚注功能支持不好[1]

<div STYLE="page-break-after: always;"></div>

<font color=#abcedf size=30>「有颜色的字体」</font>

**加粗**  
*斜体*  
~~删除线~~  
`底纹`  

* 无序列表
* 无序列表
	* 无序子列表1
	* 无序子列表1
		* 无序子列表2
	* 无序子列表1
* 无序列表

1. <font color=@abcedf>  有序列表 </font>
	1. 123
	1. 234
	1. 2344
1. 有序列表
2. 有序列表

> 我是引用文本

![图片示例](images/root.png)

[Pandora](http://192.168.60.111:8088/source/home)

## 分割线
---
***

## 代码段
```javascript
Hades._initApp = function(opts){
	Hades.App = require("./libs/core/HadesApp")
	let app = Hades.App.createApp(opts.name || "HadesProject")
	app.configConnector(opts)

	Hades.Message = require("./libs/core/HadesMessage")
	Hades.Message.init()
}
```

```lua
function Player:clearAll(battleInfo)
	if not battleInfo then
		LLCombatUtil.leaveCombat()
		self:_clearRoomInfo()
		self:_teamLeave()
	end
end
```

## 表格

| Column1 | Column1 | Column1 |
| :-----: | :-----: | :-----: |
| Cell1   | Cell2   | Cell3   |
| Cell1   | Cell2   | Cell3   |
| Cell1   | Cell2   | Cell3   |
| Cell1   | Cell2   | Cell3   |

<table>
	<th>
		<td>Foo2</td>
		<td>Foo2</td>
		<td>Foo2</td>
	</th>
    <tr>
        <td>Foo</td>
		<td>Foo</td>
		<td>Foo</td>
    </tr>
	<tr>
        <td>Foo</td>
		<td>Foo</td>
		<td>Foo</td>
    </tr>
	<tr>
        <td>Foo</td>
		<td>Foo</td>
		<td>Foo</td>
    </tr>
</table>


## 脚注

[^1]: 这里是脚注

