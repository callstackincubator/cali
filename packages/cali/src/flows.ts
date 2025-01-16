/**
 * This flow is used to run the application on the selected platform.
 */
export const runApplicationFlow = {
  agent: 'sequenceAgent',
  input: [
    {
      name: 'checkReactNativeEnvironment',
      agent: 'reactNativeAgent',
      input: `
        Check if we are in the React Native environment and whether everything is set up correctly.
        Return React Native config for the project and ask user to choose platform.
      `,
    },
    {
      agent: 'sequenceAgent',
      input: [
        {
          name: 'prepareReactNativeEnvironment',
          agent: 'reactNativeAgent',
          input: 'Start Metro development server',
        },
        {
          agent: 'oneOfAgent',
          input: [
            {
              name: 'runApplicationOnApple',
              agent: 'appleAgent',
              input: 'Run the application on the selected Apple platform.',
              when: 'User selected to run application on one of the Apple platforms',
            },
            {
              name: 'runApplicationOnAndroid',
              agent: 'androidAgent',
              input: 'Run the application on the selected Android platform.',
              when: 'User selected to run application on Android platform',
            },
          ],
        },
      ],
    },
  ],
}

/**
 * Main application flow (aka loop)
 */
export const mainFlow = {
  agent: 'sequenceAgent',
  input: [
    {
      agent: 'userInputAgent',
      input: `
        Greet the user and ask an open-ended question about what they want to do today.

        Your capabilities are:
        - Running and/or building the React Native application for Apple and Android platforms

        When user asks you to explain your capabilities, list them and then ask user to choose what they want to do.
      `,
    },
    {
      agent: 'oneOfAgent',
      input: [
        {
          ...runApplicationFlow,
          when: 'run or build the application on any platform',
        },
      ],
    },
  ],
}
