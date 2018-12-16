
declare namespace pxt.tests {
    // release-tests.json
    interface ReleaseTestConfig {
        baseUrl: string;
        target: string;
        basePath?: string;
        browsers?: ReleaseTestBrowsers[];
        tests: ReleaseTest[];
        lang?: string;
    }

    type ReleaseTestBrowsers = 'chrome' | 'safari' | 'ie' | 'edge' | 'firefox';

    interface TestProperties {
        basePath?: string;
        lang?: string;
    }

    interface ReleaseTest extends TestProperties {
        type: string;
        shouldFail?: boolean;
        name?: string;
        browsers?: ReleaseTestBrowsers[];
    }

    interface ImportTest extends ReleaseTest {
        url: string;
    }

    interface TutorialTest extends ReleaseTest {
        path: string;
    }

    interface BlocklyTest extends ReleaseTest {
        action: string;
        data: any;
    }
}