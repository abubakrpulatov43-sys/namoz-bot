Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\User\Desktop\telegram bot"
WshShell.Run "node index.js", 0, False
