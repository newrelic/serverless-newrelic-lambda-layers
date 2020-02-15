const fs = require('fs')
const os = require('os')
const path = require('path')
const _ = require('lodash/fp')
const { getInstalledPathSync } = require('get-installed-path')
const NewRelicLambdaLayerPlugin = require('../src/index')

const serverlessPath = getInstalledPathSync('serverless', { local: true })
const AwsProvider = require(`${serverlessPath}/lib/plugins/aws/provider/awsProvider`)
const CLI = require(`${serverlessPath}/lib/classes/CLI`)
const Serverless = require(`${serverlessPath}/lib/Serverless`)
const fixturesPath = path.resolve(__dirname, 'fixtures')

describe('NewRelicLambdaLayerPlugin', () => {
    const stage = 'dev'
    const options = { stage }

    describe('run', () => {
        const testCaseFiles = fs.readdirSync(fixturesPath)
        const getTestCaseName = _.pipe(_.split('.'), _.head)
        const testCaseFileType = _.pipe(_.split('.'), _.get('[1]'))
        const testCaseContentsFromFiles = _.reduce((acc, fileName) => {
            const contents = JSON.parse(fs.readFileSync(path.resolve(fixturesPath, fileName)))
            return _.set(testCaseFileType(fileName), contents, acc)
        }, {})

        const testCaseFilesByName = _.groupBy(getTestCaseName, testCaseFiles)
        this.testCases = _.map(
            (caseName) => {
                const testCaseContents = testCaseContentsFromFiles(testCaseFilesByName[caseName])
                return Object.assign(testCaseContents, { caseName })
            },
            Object.keys(testCaseFilesByName)
        )

        this.testCases.forEach(({ caseName, input, output }) => {
            it(`generates the correct CloudFormation templates: test case ${caseName}`, async () => {
                const serverless = new Serverless(options)
                Object.assign(serverless.service, input)
                serverless.cli = new CLI(serverless)
                serverless.config.servicePath = os.tmpdir()
                serverless.setProvider('aws', new AwsProvider(serverless, options))
                const plugin = new NewRelicLambdaLayerPlugin(serverless, options)

                await plugin.run()

                expect(_.omit(['serverless', 'package', 'pluginsData', 'resources', 'serviceObject'], serverless.service)).toEqual(output)
            })
        })
    })
})