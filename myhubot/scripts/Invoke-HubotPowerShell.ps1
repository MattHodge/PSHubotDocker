﻿<#
.Synopsis
   A function to execute other PowerShell functions and return the output to Hubot Scripts.
.DESCRIPTION
   A function to execute other PowerShell functions and return the output to Hubot Scripts.
.EXAMPLE
   $myhashtable = @{ Name = 'Explorer' }
   Invoke-HubotPowerShell -FilePath .\Get-ProcessHubot.ps1 -Splat $myhashtable
.EXAMPLE
   Invoke-HubotPowerShell -FilePath ./Get-ProcessHubot.ps1 -HostName 172.28.128.13 -Username vagrant -KeyPath /Users/Matthew/.ssh/powershell_win2012 -Splat @{ Name = 'Explorer' }

   Execute the command over SSH from MacOS
#>
function Invoke-HubotPowerShell
{
    [CmdletBinding()]
    [OutputType([string])]
    Param
    (
        # FilePath of the PowerShell script to execute
        [Parameter(Mandatory=$true)]
        [ValidateScript({
        if(Test-Path -Path $_ -ErrorAction SilentlyContinue)
        {
            return $true
        }
        else
        {
            throw "$($_) is not a valid path."
        }
        })]
        [string]$FilePath,

        # Splat of the paramaters to pass to the script
        [Parameter(Mandatory=$false)]
        [System.Collections.Hashtable]
        $Splat,

        # HostName to connect to via SSH
        [Parameter(Mandatory=$false)]
        [string]
        $HostName,

        # Port if running the command remotely over WinRM
        [Parameter(Mandatory=$false)]
        [int]
        $Port = 22,

        # SSH Port
        [Parameter(Mandatory=$false)]
        [string]
        $UserName,

        # Path to SSH Private Key
        [Parameter(Mandatory=$false)]
        [string]
        $KeyPath
    )

    # Set the erroraction
    $ErrorActionPreference = 'Stop'


    # Create a hashtable for the results
    $result = @{}

    # Use try/catch block
    try
    {
        $newPSSessionSplat = @{}

        if ($PSBoundParameters.ContainsKey('Port'))
        {
            $newPSSessionSplat.Port = $Port
        }

        if ($PSBoundParameters.ContainsKey('UserName'))
        {
            $newPSSessionSplat.UserName = $UserName
        }

        if ($PSBoundParameters.ContainsKey('KeyPath'))
        {
            $newPSSessionSplat.KeyPath = $KeyPath
        }

        if ($PSBoundParameters.ContainsKey('HostName'))
        {
            $newPSSessionSplat.HostName = $HostName

            Write-Verbose ($newPSSessionSplat | ConvertTo-Json)
            # splat the new session params
            $s = New-PSSession @newPSSessionSplat
        }

        $paramObj = New-Object PSObject -Property @{
            script = Get-Command $FilePath | Select-Object -ExpandProperty ScriptBlock
            splat = $Splat
        }

        if ($PSBoundParameters.ContainsKey('HostName'))
        {
            $scriptOutput = Invoke-Command -Session $s -ArgumentList @($paramObj) -ErrorAction Stop -ScriptBlock {
                $paramObj = $args[0]
                $splat = $paramObj.splat
                New-Item -Path Function:\Hubot-Function -Value $paramObj.script -Force | Out-Null
                Hubot-Function @splat
            }
        }
        else
        {
            $scriptOutput = .$paramObj.script @Splat
        }

        # If the output is an object, convert it to json
        if ($scriptOutput.GetType().FullName -eq 'System.Object[]')
        {
            $result.output = $scriptOutput | ConvertTo-Json
            $result.result_is_json = $true
        }
        # otherwise leave as a string
        else
        {
            $result.output = $scriptOutput
            $result.result_is_json = $false
        }

        # Set a successful result
        $result.success = $true
    }
    catch
    {
        $result.error = @{}
        if ($_.Exception.Message)
        {
            $result.error.message = $_.Exception.Message
        }

        if ($_.Exception.ItemName)
        {
            $result.error.itemname = $_.Exception.ItemName
        }

        if ($_.CategoryInfo.Reason)
        {
            $result.error.reason = $_.CategoryInfo.Reason
        }

        if ($_.CategoryInfo.Category)
        {
            $result.error.category = $_.CategoryInfo.Category.ToString()
        }

        if ($_.CategoryInfo.Activity)
        {
            $result.error.activity = $_.CategoryInfo.Activity
        }

        # Set a failed result
        $result.success = $false
    }

    # Return the result and conver it to json
    return $result | ConvertTo-Json
}
