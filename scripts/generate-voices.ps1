param([Parameter(Mandatory=$true)][string]$JobsPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskJobs = Get-Content -LiteralPath $JobsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskAudioFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
try {
  $taskIndex = 0
  foreach ($taskJob in $taskJobs) {
    $taskIndex++
    $taskSynth.SelectVoice($taskJob.voice)
    $taskSynth.Rate = [int]$taskJob.rate
    $taskSynth.Volume = 100
    $taskSynth.SetOutputToWaveFile($taskJob.wav, $taskAudioFormat)
    $taskEscaped = [System.Security.SecurityElement]::Escape([string]$taskJob.text)
    $taskVoiceName = [System.Security.SecurityElement]::Escape([string]$taskJob.voice)
    $taskPitch = [System.Security.SecurityElement]::Escape([string]$taskJob.pitch)
    $taskSsml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="' + $taskVoiceName + '"><prosody pitch="' + $taskPitch + '">' + $taskEscaped + '</prosody></voice></speak>'
    $taskSynth.SpeakSsml($taskSsml)
    $taskSynth.SetOutputToNull()
    if (($taskIndex % 25) -eq 0 -or $taskIndex -eq $taskJobs.Count) { Write-Output ('Synthesized ' + $taskIndex + '/' + $taskJobs.Count) }
  }
} finally {
  $taskSynth.Dispose()
}
