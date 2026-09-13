export type Skill = {
  id: string;
  name: string;
  phase: string;
  description: string;
  prerequisites: string[];
  target: number;
};

export const skills: Skill[] = [
  { id:'computer', name:'コンピュータ基礎', phase:'Foundation', description:'CPU・メモリ・OS・プロセス・ファイルシステム', prerequisites:[], target:85 },
  { id:'linux', name:'Linux', phase:'Foundation', description:'CLI・権限・プロセス・systemd・ログ・SSH', prerequisites:['computer'], target:85 },
  { id:'network', name:'Network', phase:'Foundation', description:'IP・TCP/UDP・DNS・HTTP・NAT・FW・LB', prerequisites:['computer'], target:85 },
  { id:'git', name:'Git / GitHub', phase:'Foundation', description:'バージョン管理・branch・PR・GitHub運用', prerequisites:['computer'], target:80 },
  { id:'python', name:'Python', phase:'Automation', description:'基礎文法・API・自動化・boto3', prerequisites:['computer'], target:75 },
  { id:'aws', name:'AWS', phase:'Cloud', description:'IAM・VPC・EC2・S3・RDS・ALB・CloudWatch', prerequisites:['linux','network'], target:90 },
  { id:'terraform', name:'Terraform / IaC', phase:'Cloud', description:'再現可能なクラウド基盤をコードで構築', prerequisites:['aws','git'], target:90 },
  { id:'docker', name:'Docker', phase:'Cloud Native', description:'Image・Container・Dockerfile・Compose', prerequisites:['linux','git'], target:85 },
  { id:'k8s', name:'Kubernetes', phase:'Cloud Native', description:'Pod・Deployment・Service・Ingress・EKS', prerequisites:['docker','network','aws'], target:85 },
  { id:'cicd', name:'CI/CD', phase:'Platform', description:'GitHub Actions・build・test・deploy', prerequisites:['git','docker'], target:85 },
  { id:'observability', name:'Observability / SRE', phase:'Platform', description:'Metrics・Logs・Tracing・SLI/SLO・障害対応', prerequisites:['linux','network','aws'], target:85 },
  { id:'security', name:'Cloud Security', phase:'Security', description:'IAM・Zero Trust・SIEM・IR・脆弱性管理', prerequisites:['aws','network','linux'], target:90 },
  { id:'architecture', name:'Architecture / Design', phase:'Senior', description:'要件定義・HA・DR・コスト・トレードオフ', prerequisites:['aws','terraform','security','observability'], target:85 },
  { id:'leadership', name:'Tech Lead / PM', phase:'Senior', description:'設計レビュー・顧客折衝・意思決定・チーム推進', prerequisites:['architecture'], target:80 }
];

export const todayLessons = [
  { title:'サーバ・OS・Linuxの関係', minutes:10, skill:'computer' },
  { title:'IPアドレスとは何か', minutes:12, skill:'network' },
  { title:'確認テスト 5問', minutes:5, skill:'computer' }
];
