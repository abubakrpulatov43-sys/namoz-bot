Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\User\Desktop\telegram bot"
WshShell.Run "node runner.js", 0, False
