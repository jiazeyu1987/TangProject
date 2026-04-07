Add-Type -AssemblyName System.IO.Compression.FileSystem
$path='D:\2\Tool\ai_clinical_tool_brief.docx'
$zip=[System.IO.Compression.ZipFile]::OpenRead($path)
try {
  $entry=$zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
  $reader=New-Object System.IO.StreamReader($entry.Open())
  $xmlContent=$reader.ReadToEnd()
  $reader.Close()
  [xml]$xml=$xmlContent
  $ns=New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $body=$xml.SelectSingleNode('//w:body',$ns)
  $lines=@()
  foreach($child in $body.ChildNodes){
    if($child.LocalName -eq 'p'){
      $texts=$child.SelectNodes('.//w:t',$ns) | ForEach-Object { $_.'#text' }
      $text=($texts -join '')
      if([string]::IsNullOrWhiteSpace($text)){ continue }
      $styleNode=$child.SelectSingleNode('./w:pPr/w:pStyle',$ns)
      $style=if($styleNode){ $styleNode.GetAttribute('val','http://schemas.openxmlformats.org/wordprocessingml/2006/main') } else { '' }
      $lines += ('P[['+$style+']] '+$text.Trim())
      continue
    }
    if($child.LocalName -eq 'tbl'){
      $lines += 'TABLE_START'
      foreach($tr in $child.SelectNodes('./w:tr',$ns)){
        $cells=@()
        foreach($tc in $tr.SelectNodes('./w:tc',$ns)){
          $cellTexts=$tc.SelectNodes('.//w:t',$ns) | ForEach-Object { $_.'#text' }
          $cellText=($cellTexts -join ' ').Trim()
          $cells += $cellText
        }
        $lines += ('ROW| ' + ($cells -join ' || '))
      }
      $lines += 'TABLE_END'
    }
  }
  Set-Content -Path 'D:\2\Tool\docx_body_seq.txt' -Value $lines -Encoding UTF8
}
finally {
  $zip.Dispose()
}
