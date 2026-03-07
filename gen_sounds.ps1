$dir = 'c:\Users\rb3y9\Desktop\Vaughan-Tauri\Vaughan\src-tauri\sounds\default'

function New-Wav {
    param(
        [string]$Path,
        [int]$Freq1,
        [int]$Freq2,
        [double]$Dur1,
        [double]$Dur2,
        [double]$Gap,
        [double]$Vol
    )

    $sr = 44100
    $n1 = [int]($sr * $Dur1)
    $nGap = [int]($sr * $Gap)
    $n2 = [int]($sr * $Dur2)
    $total = $n1 + $nGap + $n2
    $data = New-Object byte[] ($total * 2)
    $fade = [int]($sr * 0.015)

    for ($i = 0; $i -lt $n1; $i++) {
        $t = $i / $sr
        $v = [math]::Sin(2 * [math]::PI * $Freq1 * $t) * $Vol
        if ($i -lt $fade) { $v = $v * ($i / $fade) }
        if ($i -gt ($n1 - $fade)) { $v = $v * (($n1 - $i) / $fade) }
        $s = [int]($v * 32767)
        if ($s -gt 32767) { $s = 32767 }
        if ($s -lt -32768) { $s = -32768 }
        $idx = $i * 2
        $data[$idx] = [byte]($s -band 0xFF)
        $data[$idx + 1] = [byte](($s -shr 8) -band 0xFF)
    }

    $offset = ($n1 + $nGap) * 2
    for ($i = 0; $i -lt $n2; $i++) {
        $t = $i / $sr
        $v = [math]::Sin(2 * [math]::PI * $Freq2 * $t) * $Vol
        if ($i -lt $fade) { $v = $v * ($i / $fade) }
        if ($i -gt ($n2 - $fade)) { $v = $v * (($n2 - $i) / $fade) }
        $s = [int]($v * 32767)
        if ($s -gt 32767) { $s = 32767 }
        if ($s -lt -32768) { $s = -32768 }
        $idx = $offset + ($i * 2)
        $data[$idx] = [byte]($s -band 0xFF)
        $data[$idx + 1] = [byte](($s -shr 8) -band 0xFF)
    }

    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $dataLen = $data.Length
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
    $bw.Write([int](36 + $dataLen))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('WAVE'))
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('fmt '))
    $bw.Write([int]16)
    $bw.Write([int16]1)
    $bw.Write([int16]1)
    $bw.Write([int]$sr)
    $bw.Write([int]($sr * 2))
    $bw.Write([int16]2)
    $bw.Write([int16]16)
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
    $bw.Write([int]$dataLen)
    $bw.Write($data)
    $bw.Flush()
    [System.IO.File]::WriteAllBytes($Path, $ms.ToArray())
    $size = (Get-Item $Path).Length
    $bw.Close()
    $ms.Close()
    Write-Host "Created: $Path ($size bytes)"
}

New-Wav -Path (Join-Path $dir 'tx_incoming.wav') -Freq1 523 -Freq2 659 -Dur1 0.15 -Dur2 0.18 -Gap 0.05 -Vol 0.45
New-Wav -Path (Join-Path $dir 'tx_confirmed.wav') -Freq1 392 -Freq2 523 -Dur1 0.15 -Dur2 0.18 -Gap 0.05 -Vol 0.4
New-Wav -Path (Join-Path $dir 'dapp_request.wav') -Freq1 440 -Freq2 587 -Dur1 0.1 -Dur2 0.12 -Gap 0.03 -Vol 0.35
New-Wav -Path (Join-Path $dir 'wallet_unlock.wav') -Freq1 523 -Freq2 523 -Dur1 0.2 -Dur2 0.0001 -Gap 0.0001 -Vol 0.3
