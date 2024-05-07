// /pages/index.tsx
import Head from 'next/head';
import DatePickerComponent from '../components/DatePickerComponent';

export default function HomePage() {
  return (
    <>
        <Head>
            <title>Beast of the week</title>
        </Head>
        <div className="flex justify-center items-center h-screen bg-gray-100">
            <DatePickerComponent />
        </div>
    </>
);
}

