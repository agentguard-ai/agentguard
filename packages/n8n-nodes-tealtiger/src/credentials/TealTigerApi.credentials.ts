import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TealTigerApi implements ICredentialType {
	name = 'tealTigerApi';
	displayName = 'TealTiger API';
	documentationUrl = 'https://tealtiger.co.in';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];
}
