exports.newProject = {
    newProjectButton: '.newprojectcard',
    homeOfProject: '.openproject',
    closeButtonOfHomePage: '.closeIcon',
    inputProjectName: 'input#projectNameInput',
    saveButtonOfHomePage: '.button.positive',
    projectTitle: "[aria-label='My Projects'] .carouselitem:nth-child(2) .header",
    openProject: "[aria-label='My Projects'] .carouselitem:nth-child(2)"
}

exports.shareTheProject = {
    shareButton: '.shareproject',
    titleOfPublishButton: '.sharedialog .actions .ui.text',
    shareName: '#projectNameInput',
    publishButton: '.labeled.primary',
    copyButton: '.field i.icon',
    projectUrl: '#projectUri',
    closeButtonOfSharePage: '.closeIcon'
}

exports.switchButton = {
    switchToJavaScript: '[title="Convert code to JavaScript"]',
    titleOfExplorer: '[aria-label="File explorer toolbar"]',
    switchToBlocks: '[title="Convert code to Blocks"]'
}

exports.helpOfProject = {
    helpButton: '[title="Help"]',
    support: '[aria-label="Dropdown menu Help"] [title="Support"]',
    reference: '[aria-label="Dropdown menu Help"] [title="Reference"]',
    blocks: '[aria-label="Dropdown menu Help"] [title="Blocks"]',
    javascript: '[aria-label="Dropdown menu Help"] [title="JavaScript"]',
    hardware: '[aria-label="Dropdown menu Help"] [title="Hardware"]',
    buy: '[aria-label="Dropdown menu Help"] [title="Buy"]',
    collapseButton: '#sidedocstoggle',
    goBackButton: '#sidedocs-back-button',
    titleAfterGoBack: '.ui.text h1',
    openLinkButton: '#sidedocsbar',
    titleOfBlocksPage: '#blocks-language',
    titleOfReferencePage: '#reference',
    titleOfJavaScriptPage: '#javascript',
    headerTitleOfSupport:'h2.hide-in-mobile',
    headerTitleOfBuy:'.alpha'
}

exports.moreOfProject = {
    moreButton: '[title="More..."]',
    projectSettings: '[title="Project Settings"]',
    goBackButtonInSettings: '[title="Go back"]',
    nameInputBoxInSettings: '#fileNameInput',
    saveButtonInSettings: '.ui.button.green',
    editSettingsAsTextButton: '.field .ui.button:nth-child(2)',
    extensionsOption: '[title="Extensions"]',
    FirstExtensionTitle: '.ui.card.link:nth-child(1) .header',
    goBackButtonInExtensions: '.header-close [title="Go back"]',
    deleteOption: '[title="Delete Project"]',
    titleOfDeleteAlert: '.header-title',
    cancelButton: 'button.cancel',
    reportAbuse: '[title="Report Abuse..."]',
    languageOption: '[title="Language"]',
    headerTitle: '.header-title',
    closeButton: '.closeIcon',
    turnOnTheHighContrast: '[title="More..."] .ui:nth-child(8)',
    turnOnTheGreenScreen: '[title="Green Screen On"]',
    nameOfCamera: '.ui.card.link .header',
    chooseTheGreenBackGround: '.massive',
    pairDevice: '[title="Pair device"]',
    aboutOption: '[title="About..."]',
    okButtonOfAbout: '.positive',
    resetOption: '[title="Reset"]',
    textOfReset: '.dimmed .content p',
    resetButton: '.actions .red'
}

exports.editorTools = {
    toggleCategoryAdvanced: '[role="treeitem"]:nth-child(11) .blocklyTreeRow',
    collapseButton: '.collapse-button:nth-child(1)',
    downloadButton: '#downloadArea .download-button',
    headerTitle: '.header-title',
    closeButton: '.closeIcon',
    nameOfInputBox: 'input#fileNameInput2',
    saveInputName: '#projectNameArea [title="Save"]'
}

exports.dragBlocks = {
    searchBox: '.blocklySearchInputField',
    searchLabel: '[id="blocklySearchLabel"]',
    foreverBlock: 'g.blocklyDraggable:nth-child(2)',
    sayHelloBlock: 'g.blocklyDraggable:nth-child(4)',
    basicItem: '[aria-label="Toggle category Basic"]',
    showStringBlock: 'g.blocklyDraggable:nth-child(8)[data-shapes="stack"]',
    trashArea: 'div.blocklyToolboxDiv',
    insertBlock: 'g.blocklyDraggable:nth-child(2)',
    duplicateOptionOfInsertBlock: '.goog-menuitem:nth-child(1)',
    duplicateBlock: '.blocklySelected.blocklyDisabled',
    deleteDuplicateBlock: '.goog-menuitem:nth-child(3)',
    addComment: '.goog-menuitem:nth-child(2)',
    textBox: 'body textarea',
    commentDeleteButton: 'g.blocklyCommentDeleteIcon',
    helpOptionOfInsertBlock: '.goog-menuitem:nth-child(4)',
    titleOfInsertBlock: '#show-string',
    collapseButton: '[id="sidedocstoggle"]',
    deleteInsertBlock: '.goog-menuitem:nth-child(3)',
    fullScreenButton: '.fullscreen-button',
    exitFullScreen: '[title="Exit fullscreen mode"]',
    microbitLogo:'[aria-label="micro:bit Logo"]'
}

exports.tutorials = {
    flashingHeart: '[aria-label="Flashing Heart"]',
    nameTag: '[aria-label="Name Tag"]',
    smileyButtons: '[aria-label="Smiley Buttons"]',
    dice: '[aria-label="Dice"]',
    loveMeter: '[aria-label="Love Meter"]',
    microChat: '[aria-label="Micro Chat"]',
}

exports.games = {
    rockPaperScissors: '[aria-label="Rock Paper Scissors"]',
    coinFlipper: '[aria-label="Coin Flipper"]',
    reactionTime: '[aria-label="Reaction Time"]',
    magicButtonTrick: '[aria-label="Magic Button Trick"]',
    snapTheDot: '[aria-label="Snap the dot"]',
    salute: '[aria-label="Salute!"]',
    karelTheLed: '[aria-label="Karel the LED"]',
    crashyBird: '[aria-label="Crashy bird"]',
    titleOfReactionTime: '#reaction-time',
    titleOfMagic: '#magic-button-trick',
    titleOfSalute: '#salute-',
    titleOfKarelTheLed:'#karel-the-led',
    titleOfCrashyBird:'#crashy-bird',
}

exports.radioGames = {
    multiDice:'[aria-label="Multi Dice"]',
    moodRadio:'[aria-label="Mood Radio"]',
    telePotato:'[aria-label="Tele-potato"]',
    fireFlies:'[aria-label="Fireflies"]',
    hotOrCold:'[aria-label="Hot or Cold"]',
    redLightGreenLight:'[aria-label="Red Light Green Light"]',
    votingMachine:'[aria-label="Voting Machine"]',
    rockPaperScissorsTeams:'[aria-label="Rock Paper Scissors Teams"]',
    microCoin:'[aria-label="Micro:Coin"]',
    infection:'[aria-label="Infection"]',
    bestFriends:'[aria-label="Best Friends"]',
    titleOfMoodRadio:'#mood-radio',
    titleOfTelePotato:'#tele-potato',
    titleOfFireflies:'#fireflies',
    titleOfHotOrCold:'#hot-or-cold',
    titleOfRedLightGreenLight:'#red-light-green-light',
    titleOfVotingMachine:'#voting-machine',
    titleOfRockPaperScissorsTeams:'#rock-paper-scissors-teams',
    titleOfMicroCoin:'#micro-coin',
    titleOfInfection:'#infection',
    titleOfBestFriends:'#best-friends',
}
    
exports.fashion = {
    ductTapeWallet:'[aria-label="Duct Tape Wallet"]',
    watch: '[aria-label="Watch"]',
    stopWatch:'[aria-label="Stopwatch"]',
    stepCounter:'[aria-label="Step counter"]',
    ductTapeWatch:'[aria-label="Duct Tape Watch"]',
    nameBadge:'[aria-label="Name badge"]',
    titleOfWallet:'#wallet',
    titleOfNewPage:'#make',
    titleOfWatch:'#the-watch',
    titleOfMakeWatch:'#the-watch-make',
    titleOfStopWatch:'#stopwatch',
    titleOfStepCounter:'#step-counter',
    titleOfDuctTapeWatch:'#duct-tape-watch',
    titleOfNameBadge:'#name-badge',

}

exports.music = {
    hackYourHeadphones:'[aria-label="Hack Your Headphones"]',
    bananaKeyboard:'[aria-label="Banana Keyboard"]',
    guitar:'[aria-label="Guitar"]',
    titleOfHeadphones:'#hack-your-headphones',
    titleOfkeyBoard:'#banana-keyboard',
    titleOfGuitar:'#guitar',
}

exports.toys = {
    inchworm:'[aria-label="Inchworm"]',
    milkCartonRobot:'[aria-label="Milk Carton Robot"]',
    robotUnicorn:'[aria-label="Robot Unicorn"]',
    milkMonster:'[aria-label="Milky Monster"]',
    railwayCrossing:'[aria-label="Railway Crossing"]',
    kitronikRCCarHack:'[aria-label="Kitronik RC Car Hack"]',
    rotaryDialRadio:'[aria-label="Rotary Dial Radio"]',
    titleOfInchworm:'#inchworm',
    titleOfMilkCartonRobot:'#milk-carton-robot',
    titleOfRobotUnicorn:'#robot-unicorn',
    titleOfMilkMonster:'#milk-monster',
    titleOfRailwayCrossing:'#railway-crossing',
    titleOfRCCar:'#rc-car',
    titleOfRotaryDialRadio:'#rotary-dial-radio',
}

exports.science = {
    timingGates:'[aria-label="Timing Gates"]',
    soilMoisture:'[aria-label="Soil Moisture"]',
    plantWatering:'[aria-label="Plant Watering"]',
    statesOfMatter:'[aria-label="States of Matter"]',
    titleOfTimingGates:'#timing-gates',
    titleOfSoilMoisture:'#soil-moisture',
    titleOfPlantWatering:'#plant-watering',
    titleOfStatesOfMatter:'#states-of-matter'
}

exports.tools = {
    plotAcceleration:'[aria-label="Plot Acceleration"]',
    lightLevelMeter:'[aria-label="Light Level Meter"]',
    analogPinTester:'[aria-label="Analog Pin Tester"]',
    servoCalibrator:'[aria-label="Servo Calibrator"]',
    radioBridge:'[aria-label="Radio Bridge"]',
    titleOfPlotAcceleration:'#plot-acceleration',
    titleOfLightLevelMeter:'#light-level-meter',
    titleOfAnalogPinTester:'#analog-pin-tester',
    titleOfServoCalibrator:'#servo-calibrator',
    openExample:'.actions .positive'
}

exports.commonActions = {
    startTutorial: '.actions button',
    showInstructions: '.actions .positive',
    playButton: '.video',
    videoPlay: '[aria-label="Play"]',
    videoTitle: '.yt-uix-sessionlink',
    closeButton: '.closeIcon',
    alertContent: '.scrolling.content p:nth-child(1)',
    headerTitle: '.header-title',
    okButton: '.actions button.green',
    goBackButton: '.prevbutton',
    goNextButton: '.buttons .nextbutton',
    selectedLabel: 'a.blue.selected',
    finishButton: '[aria-label="Finish the tutorial."]',
    microbitLogo: '[aria-label="micro:bit Logo"]',
    prograss: '[aria-label="My Projects"] .carouselitem:nth-child(2)',
    projectName: '#fileNameInput2',
    seeMoreOfTutorials: '[aria-label="Tutorials"] [aria-label="See more"]',
    seeMoreOfGames: '[aria-label="Games"] [aria-label="See more"]',
    idOfIframe: '#sidedocsframe',
    getStartButton:'.docbutton',
    openInNewTab:'#sidedocsbar'
}

