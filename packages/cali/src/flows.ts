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
        Greet the user by saying random fun fact about React or React Native, then ask an open ended question about what they want to do today.

        Your capabilities are:
        - Running and/or building the application for Apple and Android platforms

        General rules:
        - Return ONLY the user's decision without any additional commentary
        - If user asks you to explain your capabilities, list them and then ask again
        - If user asks for something outside your capabilities, return "exit"
        - If user provides specific details, include them in brackets like [platform: iOS, device: simulator]
        - Format all responses as "User selected to {action} [detail1: value1, detail2: value2]"
      `,
    },
    {
      agent: 'oneOfAgent',
      input: [
        {
          ...runApplicationFlow,
          when: 'User selected to run the application on the selected platform',
        },
        {
          agent: 'processAgent',
          input: 'Exit',
          when: 'User selected to exit',
        },
      ],
    },
  ],
}
