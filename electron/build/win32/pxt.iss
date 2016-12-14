#define LocalizedLanguageFile(Language = "") \
    DirExists(RepoDir + "\licenses") && Language != "" \
      ? ('; LicenseFile: "' + RepoDir + '\licenses\LICENSE-' + Language + '.txt"') \
      : '; LicenseFile: "' + RepoDir + '\LICENSE.txt"'

[Setup]
AppId={#AppId}
AppName={#NameLong}
AppVerName={#NameVersion}
AppPublisher=Microsoft Corporation
AppPublisherURL=https://www.pxt.io/
AppSupportURL=https://www.pxt.io/
AppUpdatesURL=https://www.pxt.io/
DefaultDirName={pf}\{#DirName}
DefaultGroupName={#NameLong}
AllowNoIcons=yes
OutputDir={#DistDir}
OutputBaseFilename={#InstallerBaseName}
Compression=lzma
SolidCompression=yes
AppMutex={#AppMutex}
; WizardImageFile={#RepoDir}\resources\win32\inno-big.bmp
; WizardSmallImageFile={#RepoDir}\resources\win32\inno-small.bmp
; SetupIconFile={#RepoDir}\resources\win32\code.ico
UninstallDisplayIcon={app}\{#ExeBasename}.exe
ChangesEnvironment=true
ChangesAssociations=true
MinVersion=6.1.7600
SourceDir={#SourceDir}
AppVersion={#Version}
VersionInfoVersion={#RawVersion}
ShowLanguageDialog=auto

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl,{#RepoDir}\build\win32\strings\installer.en.isl" {#LocalizedLanguageFile}
; Name: "german"; MessagesFile: "compiler:Languages\German.isl,{#RepoDir}\build\win32\i18n\messages.de.isl" {#LocalizedLanguageFile("deu")}
; Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl,{#RepoDir}\build\win32\i18n\messages.es.isl" {#LocalizedLanguageFile("esp")}
; Name: "french"; MessagesFile: "compiler:Languages\French.isl,{#RepoDir}\build\win32\i18n\messages.fr.isl" {#LocalizedLanguageFile("fra")}
; Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl,{#RepoDir}\build\win32\i18n\messages.it.isl" {#LocalizedLanguageFile("ita")}
; Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl,{#RepoDir}\build\win32\i18n\messages.ja.isl" {#LocalizedLanguageFile("jpn")}
; Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl,{#RepoDir}\build\win32\i18n\messages.ru.isl" {#LocalizedLanguageFile("rus")}
; Name: "korean"; MessagesFile: "{#RepoDir}\build\win32\i18n\Default.ko.isl,{#RepoDir}\build\win32\i18n\messages.ko.isl" {#LocalizedLanguageFile("kor")}
; Name: "simplifiedChinese"; MessagesFile: "{#RepoDir}\build\win32\i18n\Default.zh-cn.isl,{#RepoDir}\build\win32\i18n\messages.zh-cn.isl" {#LocalizedLanguageFile("chs")}
; Name: "traditionalChinese"; MessagesFile: "{#RepoDir}\build\win32\i18n\Default.zh-tw.isl,{#RepoDir}\build\win32\i18n\messages.zh-tw.isl" {#LocalizedLanguageFile("cht")}

[InstallDelete]
Type: filesandordirs; Name: {app}\resources\app

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 0,6.1
; Name: "associatewithfiles"; Description: "{cm:AssociateWithFiles,{#NameShort}}"; GroupDescription: "{cm:Other}"; Flags: unchecked
Name: "runpxt"; Description: "{cm:RunAfter,{#NameShort}}"; GroupDescription: "{cm:Other}"; Check: WizardSilent

[Files]
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#NameLong}"; Filename: "{app}\{#ExeBasename}.exe"; AppUserModelID: "{#AppUserId}"
Name: "{commondesktop}\{#NameLong}"; Filename: "{app}\{#ExeBasename}.exe"; Tasks: desktopicon; AppUserModelID: "{#AppUserId}"
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#NameLong}"; Filename: "{app}\{#ExeBasename}.exe"; Tasks: quicklaunchicon; AppUserModelID: "{#AppUserId}"

[Run]
Filename: "{app}\{#ExeBasename}.exe"; Description: "{cm:LaunchProgram,{#NameLong}}"; Tasks: runpxt; Flags: nowait postinstall; Check: WizardSilent
Filename: "{app}\{#ExeBasename}.exe"; Description: "{cm:LaunchProgram,{#NameLong}}"; Flags: nowait postinstall; Check: WizardNotSilent

[Code]
function WizardNotSilent(): Boolean;
begin
  Result := not WizardSilent();
end;
