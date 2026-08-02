import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { TealGuard } from 'tealtiger';

export class TealTiger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TealTiger Governance',
		name: 'tealTiger',
		icon: 'file:tealtiger.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Evaluate TealTiger policies',
		description: 'Enforces security policies, tracks costs, and produces structured evidence via TealTiger',
		defaults: {
			name: 'TealTiger',
		},
		inputs: ['main'],
		outputs: ['main', 'main', 'main'],
		outputNames: ['Approved', 'Blocked', 'Needs Review'],
		credentials: [
			{
				name: 'tealTigerApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'gpt-4o-mini',
				description: 'The model to evaluate against',
			},
			{
				displayName: 'Input Content',
				name: 'content',
				type: 'string',
				default: '',
				description: 'The prompt or content to evaluate',
			},
			{
				displayName: 'PII Detection',
				name: 'piiDetection',
				type: 'boolean',
				default: true,
				description: 'Whether to enable PII detection',
			},
			{
				displayName: 'Prompt Injection',
				name: 'promptInjection',
				type: 'boolean',
				default: true,
				description: 'Whether to enable Prompt Injection prevention',
			},
			{
				displayName: 'Content Moderation',
				name: 'contentModeration',
				type: 'boolean',
				default: true,
				description: 'Whether to enable Content Moderation',
			}
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const approvedData: INodeExecutionData[] = [];
		const blockedData: INodeExecutionData[] = [];
		const needsReviewData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('tealTigerApi');

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const model = this.getNodeParameter('model', itemIndex) as string;
				const content = this.getNodeParameter('content', itemIndex) as string;
				
				const piiDetection = this.getNodeParameter('piiDetection', itemIndex) as boolean;
				const promptInjection = this.getNodeParameter('promptInjection', itemIndex) as boolean;
				const contentModeration = this.getNodeParameter('contentModeration', itemIndex) as boolean;

				const config: any = { 
					guardrails: {
						pre: {
							pii: piiDetection,
							injection: promptInjection,
							content: contentModeration
						}
					}
				};
				process.env.TEALTIGER_API_KEY = credentials.apiKey as string;
				const guard = new (TealGuard as any)(config);
				
				const decisionObj = await guard.check({ content });
				const decision = decisionObj.action || 'ALLOW';

				const newItem = {
					json: {
						...items[itemIndex].json,
						tealTiger: {
							decision,
							securityInfo: decisionObj
						}
					}
				};

				if (decision === 'ALLOW') {
					approvedData.push(newItem);
				} else if (decision === 'DENY' || decision === 'BLOCK') {
					blockedData.push(newItem);
				} else {
					needsReviewData.push(newItem);
				}
			} catch (error: any) {
				if (this.continueOnFail()) {
					blockedData.push({ 
						json: { 
							...items[itemIndex].json,
							error: error.message 
						}
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error, { itemIndex });
			}
		}

		return [approvedData, blockedData, needsReviewData];
	}
}
