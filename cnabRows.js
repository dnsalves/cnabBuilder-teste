'use strict';
import path from 'path'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname } from 'path';
import fs from 'fs'

import yargs from 'yargs'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const optionsYargs = yargs(process.argv.slice(2))
  .usage('Uso: $0 [options]')
  .option("f", { alias: "from", describe: "posição inicial de pesquisa da linha do Cnab", type: "number" })
  .option("t", { alias: "to", describe: "posição final de pesquisa da linha do Cnab", type: "number" })
  .option("s", { alias: "segment", describe: "tipo de segmento", type: "string" })
  .option("n", { alias: "companyName", describe: "nome da empresa de pesquisa da linha do Cnab", type: "string" })
  .option("a", { alias: "archive", describe: "caminho do arquivo Cnab", type: "string", demandOption: true })
  // .check(argv => {
  //   if (!argv.companyName && !argv.segment) {
  //     throw new Error('A opção "segment" é obrigatória se "companyName" não for fornecido.');
  //   }
  //   return true;
  // })
  .example('$0 -f 21 -t 34 -s p -n "NomeEmpresa" -a ./caminho/do/seu/arquivo.cnab', 'lista a linha e campo que from e to do cnab')
  .argv;

const { from, to, segment, companyName, archive = '' } = optionsYargs

const filePath = path.isAbsolute(archive) ? archive : path.resolve(fileURLToPath(import.meta.url), archive)

const sliceArrayPosition = (arr, ...positions) => [...arr].slice(...positions)

const getCnabBySegment = (arr, segment) => arr.filter((i) => i.split(' ')[0].substring(13).toLowerCase() == segment.toLowerCase())

const messageLog = (segment, segmentType, from, to) => `
----- Cnab linha ${segmentType} -----

posição from: ${chalk.inverse.bgBlack(from)}

posição to: ${chalk.inverse.bgBlack(to)}

item isolado: ${chalk.inverse.bgBlack(segment.substring(from - 1, to))}

item dentro da linha ${segmentType.toUpperCase()}: 
  ${segment.substring(0, from)}${chalk.inverse.bgBlack(segment.substring(from - 1, to))}${segment.substring(to)}

----- FIM ------
`

const log = console.log

console.time('leitura Async')

readFile(filePath, 'utf8')
  .then(file => {
    const cnabArray = file.split('\r\n')
        
    const cnabBodySegments = sliceArrayPosition(cnabArray, 2, -2)    

    if (companyName) {
      const companyNameStart = 33;
      const companyNameEnd = 72;
      const companyAddressStart = 72;
      const companyAddressEnd = 127;

      const companyNameRegex = new RegExp(companyName, 'i');
      const companies = [];
      
      //linhas com company name são do segmento Q (VALIDAR)
      const cnabBySegment = getCnabBySegment(cnabBodySegments, 'Q')

      cnabBySegment.forEach((segment) => {
        const company = segment.substring(companyNameStart, companyNameEnd);
        const match = company.match(companyNameRegex);
        
        if (match) {
          const matchStartPosition = match.index + 33;
          const matchEndPosition = matchStartPosition + match[0].length;

          const segmentInitialCode = segment.split(' ')[0];
          const segmentType = segmentInitialCode[segmentInitialCode.length - 1];

          log(messageLog(segment, segmentType, matchStartPosition, matchEndPosition));

          const companyName = segment.substring(companyNameStart, companyNameEnd).trim().replace(/\s+/g, ' ');
          const companyAddress = segment.substring(companyAddressStart, companyAddressEnd).trim().replace(/\s+/g, ' ');

          companies.push({ name: companyName, address: companyAddress });

          const jsonCompanies = JSON.stringify(companies, null, 2);
          
          const jsonFilePath = path.join(__dirname, 'companies.json');
          fs.writeFileSync(jsonFilePath, jsonCompanies, { flag: 'w' });
        }
      });
    } else {
      const cnabBySegment = getCnabBySegment(cnabBodySegments, segment)
      cnabBySegment.map((item) => log(messageLog(item, segment, from, to)))
      return;
    }
  })
  .catch(error => {
    console.log("🚀 ~ file: cnabRows.js ~ line 76 ~ error", error)
  })
console.timeEnd('leitura Async')