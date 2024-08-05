// /pages/index.tsx
import { useRouter } from 'next/router';
import Head from 'next/head';
import DatePickerComponent from '../components/DatePickerComponent';
import { Button } from '@nextui-org/react';

export default function HomePage() {
  const router = useRouter();

  const handleRedirect = () => {
    router.push('/backup-oracle');
  };

  return (
    <>
      <Head>
        <title>Beast of the week</title>
      </Head>
      <div className="relative flex justify-center items-center h-screen bg-gray-100">
        <div className="absolute top-4 right-4">
          <Button color="primary" variant="ghost" onClick={handleRedirect}>
            Backup Oracle Timestamp
          </Button>
        </div>
        <DatePickerComponent />
      </div>
    </>
  );
}
